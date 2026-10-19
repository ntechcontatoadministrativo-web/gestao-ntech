import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { db } from "../db";
import { avisar } from "../avisos";

export const MODELO_IA = "claude-opus-5-5";

export const iaConfigurada = () => !!process.env.ANTHROPIC_API_KEY;

// Formato do escopo devolvido pela IA (structured outputs: o JSON sempre segue este schema).
export const Levantamento = z.object({
  resumo: z.string().describe("Resumo executivo: problema do cliente, solução proposta e resultado esperado, em 3 a 5 frases."),
  tipo: z.enum(["SOFTWARE", "SITE", "SUPORTE", "PRODUTO", "INTERNO"]).describe("Tipo de projeto no sistema da NTECH."),
  tipoProjeto: z.string().describe("Descrição curta. Ex.: App mobile de agendamento com painel web; Landing page de captação; E-commerce com integração ao ERP."),
  complexidade: z.enum(["baixa", "media", "alta"]),
  dadosIdentificados: z
    .array(
      z.object({
        campo: z.string().describe("Ex.: Público-alvo, Plataformas, Volume de usuários, Integrações, Prazo desejado, Orçamento."),
        valor: z.string(),
        fonte: z.string().describe("Documento/página de onde veio, ou 'estimativa' / 'a confirmar'."),
      }),
    )
    .describe("Informações extraídas do briefing."),
  stackSugerida: z
    .array(z.object({ camada: z.string().describe("Ex.: Front-end, Back-end, Banco, Mobile, Hospedagem, Pagamentos"), tecnologia: z.string(), motivo: z.string() }))
    .describe("Stack recomendada, priorizando o que a equipe da NTECH já usa."),
  escopo: z.array(z.object({ item: z.string(), descricao: z.string() })).describe("Módulos / funcionalidades dentro do escopo."),
  foraDoEscopo: z.array(z.string()).describe("O que explicitamente NÃO está incluso, para evitar mal-entendido com o cliente."),
  integracoes: z.array(z.string()).describe("APIs e sistemas externos (pagamento, WhatsApp, ERP, login social...)."),
  requisitosNaoFuncionais: z.array(z.string()).describe("Desempenho, segurança, LGPD, acessibilidade, SEO, disponibilidade."),
  entregaveis: z.array(z.string()).describe("Ex.: protótipo no Figma, app nas lojas, painel web, documentação, treinamento."),
  etapas: z
    .array(
      z.object({
        nome: z.string(),
        descricao: z.string(),
        dias: z.number().describe("Dias corridos previstos para a etapa."),
        entregaveis: z.array(z.string()),
      }),
    )
    .describe("Etapas na ordem de execução, usando os nomes de etapa padrão da empresa quando fizer sentido."),
  backlog: z
    .array(
      z.object({
        titulo: z.string().describe("Curto e acionável. Ex.: Cadastro e login com e-mail e Google"),
        tipo: z.enum(["FEATURE", "MELHORIA", "TAREFA", "PESQUISA"]),
        descricao: z.string().describe("História de usuário ('Como..., quero..., para...') seguida de critérios de aceite em lista."),
        pontos: z.number().describe("Story points na escala 1, 2, 3, 5, 8, 13."),
        prioridade: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]),
        etapa: z.string().describe("Nome exato de uma das etapas acima em que o item é feito."),
      }),
    )
    .describe("Backlog inicial do projeto, do mais importante para o menos importante. Quebre itens maiores que 13 pontos."),
  estimativaHoras: z.object({ minimo: z.number(), maximo: z.number() }).describe("Faixa de horas de trabalho da equipe para todo o escopo."),
  prazoTotalDias: z.number(),
  justificativaPrazos: z.string().describe("Como prazos e pontos foram estimados, citando o histórico real da empresa quando houver."),
  premissas: z.array(z.string()),
  riscos: z.array(z.object({ descricao: z.string(), impacto: z.enum(["baixo", "medio", "alto"]), mitigacao: z.string() })),
  perguntasCliente: z.array(z.string()).describe("Perguntas objetivas para fechar o escopo com o cliente."),
  documentosFaltantes: z.array(z.string()).describe("Materiais que faltam: identidade visual, textos, acessos, APIs, contas nas lojas..."),
});
export type ResultadoLevantamento = z.infer<typeof Levantamento>;

const SISTEMA = `Você é o tech lead / arquiteto de soluções da NTECH, uma empresa de tecnologia em Belém (PA), Brasil, que desenvolve software sob medida (web, mobile, automações), sites, produtos próprios (SaaS) e presta suporte.
Sua tarefa é transformar o BRIEFING de um cliente (documentos, prints, e-mails, áudios transcritos, propostas anteriores) em um ESCOPO pronto para virar projeto: módulos, stack, etapas, backlog com pontos, prazos e riscos.

Como trabalhar:
- Leia tudo com atenção: telas e prints (identifique funcionalidades), fluxos descritos, sistemas que o cliente já usa, volume de usuários, prazos e restrições de orçamento.
- Separe com clareza o que foi LIDO no briefing do que é ESTIMATIVA ou SUPOSIÇÃO sua. Nunca invente requisitos: quando faltar informação, registre como "a confirmar" e inclua a pergunta correspondente em perguntasCliente.
- Proponha um MVP enxuto primeiro: ordene o backlog para entregar valor cedo e deixe o "desejável" com prioridade menor.
- Liste o que fica fora do escopo para proteger a empresa de escopo infinito.
- Lembre de itens que costumam ser esquecidos: setup de repositório e CI/CD, ambientes (homologação e produção), autenticação, LGPD (termos e consentimento), e-mails transacionais, painel administrativo, publicação nas lojas, monitoramento e backup.
- Use os nomes de etapa padrão da empresa quando fizer sentido e distribua os itens do backlog nessas etapas.
- Calibre pontos, horas e prazos com o histórico real da empresa quando ele for fornecido (horas por ponto, velocidade por sprint, duração real das etapas) e explique isso em justificativaPrazos.
- Escreva em português do Brasil, de forma objetiva, para ser lido pelo gestor e pela equipe de desenvolvimento.`;

const MIMES_IMAGEM = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type MimeImagem = (typeof MIMES_IMAGEM)[number];

export type DocumentoEntrada = { nome: string; tipo: string; dados: Buffer };

export const LIMITES = { totalBytes: 22 * 1024 * 1024, imagemBytes: 5 * 1024 * 1024, arquivos: 20 };

export function tipoSuportado(tipo: string, nome: string) {
  if (tipo === "application/pdf" || MIMES_IMAGEM.includes(tipo as MimeImagem)) return true;
  return tipo.startsWith("text/") || /\.(txt|md|csv)$/i.test(nome);
}

// Histórico real: duração das etapas, velocidade das sprints e horas por ponto.
async function historicoDaEmpresa() {
  const [modelos, etapas, projetosRecentes, sprints, itensFeitos] = await Promise.all([
    db.modeloEtapa.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" } }),
    db.etapa.findMany({
      where: { status: "CONCLUIDA", iniciadaEm: { not: null }, concluidaEm: { not: null } },
      select: { nome: true, iniciadaEm: true, concluidaEm: true, prazo: true },
      orderBy: { concluidaEm: "desc" },
      take: 400,
    }),
    db.projeto.findMany({
      where: { status: { in: ["CONCLUIDO", "ATIVO"] } },
      select: { nome: true, tipo: true, stack: true, dataInicio: true, prazoFinal: true, status: true, _count: { select: { etapas: true } } },
      orderBy: { criadoEm: "desc" },
      take: 15,
    }),
    db.sprint.findMany({
      where: { status: "CONCLUIDA" },
      select: { inicio: true, fim: true, tarefas: { where: { status: "FEITA" }, select: { pontos: true } } },
      orderBy: { fim: "desc" },
      take: 20,
    }),
    db.tarefa.findMany({
      where: { status: "FEITA", pontos: { not: null }, apontamentos: { some: {} } },
      select: { pontos: true, apontamentos: { select: { minutos: true } } },
      orderBy: { concluidaEm: "desc" },
      take: 300,
    }),
  ]);

  const porNome = new Map<string, { dias: number[]; atrasos: number }>();
  for (const e of etapas) {
    const dias = Math.max(1, Math.round((e.concluidaEm!.getTime() - e.iniciadaEm!.getTime()) / 86400000));
    const k = e.nome.trim().toLowerCase();
    const reg = porNome.get(k) ?? { dias: [], atrasos: 0 };
    reg.dias.push(dias);
    if (e.prazo && e.concluidaEm! > e.prazo) reg.atrasos++;
    porNome.set(k, reg);
  }

  const linhas: string[] = [];
  linhas.push("Etapas padrão da empresa (nome — dias planejados — tipo de projeto):");
  for (const m of modelos) linhas.push(`- ${m.nome} — ${m.diasPadrao} dias — ${m.tipo ?? "todos"}${m.descricao ? ` (${m.descricao})` : ""}`);

  if (itensFeitos.length) {
    const pontos = itensFeitos.reduce((a, t) => a + (t.pontos ?? 0), 0);
    const minutos = itensFeitos.reduce((a, t) => a + t.apontamentos.reduce((b, x) => b + x.minutos, 0), 0);
    linhas.push("", `Horas por ponto (itens concluídos com horas apontadas): ${(minutos / 60 / Math.max(1, pontos)).toFixed(1)} h/ponto, n=${itensFeitos.length} itens.`);
  }
  if (sprints.length) {
    const vel = sprints.map((s) => s.tarefas.reduce((a, t) => a + (t.pontos ?? 0), 0));
    const dur = sprints.map((s) => Math.round((s.fim.getTime() - s.inicio.getTime()) / 86400000) + 1);
    linhas.push(`Velocidade das últimas ${sprints.length} sprints: média ${(vel.reduce((a, b) => a + b, 0) / vel.length).toFixed(1)} pontos por sprint de ~${Math.round(dur.reduce((a, b) => a + b, 0) / dur.length)} dias.`);
  }

  if (porNome.size) {
    linhas.push("", "Duração REAL das etapas concluídas (média / mín–máx, nº de amostras, quantas atrasaram):");
    for (const [nome, r] of Array.from(porNome)) {
      const media = r.dias.reduce((a, b) => a + b, 0) / r.dias.length;
      linhas.push(`- ${nome}: ${media.toFixed(1)} dias (${Math.min(...r.dias)}–${Math.max(...r.dias)}), n=${r.dias.length}, atrasadas=${r.atrasos}`);
    }
  } else {
    linhas.push("", "Ainda não há etapas concluídas com datas reais no histórico — use os dias planejados e boas práticas de mercado como referência.");
  }
  if (projetosRecentes.length) {
    linhas.push("", "Projetos recentes da empresa (para referência de stack e prazo):");
    for (const p of projetosRecentes) {
      const dur = p.prazoFinal ? Math.round((p.prazoFinal.getTime() - p.dataInicio.getTime()) / 86400000) : null;
      linhas.push(`- ${p.nome} [${p.tipo}]${p.stack ? ` stack: ${p.stack}` : ""} — ${p._count.etapas} etapas${dur ? `, prazo total ${dur} dias` : ""} (${p.status.toLowerCase()})`);
    }
  }
  return linhas.join("\n");
}

function blocoDocumento(d: DocumentoEntrada): Anthropic.Beta.BetaContentBlockParam {
  if (d.tipo === "application/pdf") {
    return { type: "document", title: d.nome, source: { type: "base64", media_type: "application/pdf", data: d.dados.toString("base64") } };
  }
  if (MIMES_IMAGEM.includes(d.tipo as MimeImagem)) {
    return { type: "image", source: { type: "base64", media_type: d.tipo as MimeImagem, data: d.dados.toString("base64") } };
  }
  return { type: "text", text: `<documento nome="${d.nome}">\n${d.dados.toString("utf8").slice(0, 200_000)}\n</documento>` };
}

const client = () => new Anthropic();

// Roda em segundo plano depois que o gestor envia os documentos; grava o resultado no banco.
export async function executarLevantamento(
  id: string,
  dados: { titulo: string; cliente: string | null; observacoes: string | null; documentos: DocumentoEntrada[] },
) {
  try {
    const historico = await historicoDaEmpresa();
    const conteudo: Anthropic.Beta.BetaContentBlockParam[] = [];
    for (const d of dados.documentos) {
      if (MIMES_IMAGEM.includes(d.tipo as MimeImagem)) conteudo.push({ type: "text", text: `Imagem: ${d.nome}` });
      conteudo.push(blocoDocumento(d));
    }
    conteudo.push({
      type: "text",
      text: [
        `Projeto: ${dados.titulo}`,
        dados.cliente ? `Cliente: ${dados.cliente}` : null,
        dados.observacoes ? `Briefing / observações do gestor:\n${dados.observacoes}` : null,
        "",
        "<historico_da_empresa>",
        historico,
        "</historico_da_empresa>",
        "",
        "Monte o escopo completo deste projeto (com backlog inicial) a partir do briefing acima.",
      ]
        .filter((l) => l !== null)
        .join("\n"),
    });

    const resposta = await client().beta.messages.parse({
      model: MODELO_IA,
      max_tokens: 20000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: betaZodOutputFormat(Levantamento) },
      system: SISTEMA,
      messages: [{ role: "user", content: conteudo }],
    });

    if (resposta.stop_reason === "refusal") {
      throw new Error("A IA não pôde analisar este briefing. Revise o conteúdo enviado e tente de novo.");
    }
    if (resposta.stop_reason === "max_tokens") {
      throw new Error("O escopo ficou grande demais e foi interrompido. Envie menos documentos ou divida o projeto em fases.");
    }
    const resultado = resposta.parsed_output;
    if (!resultado) throw new Error("A IA não devolveu um escopo válido. Tente novamente.");

    await db.levantamento.update({
      where: { id },
      data: {
        status: "CONCLUIDO",
        resultado,
        modelo: resposta.model,
        tokensEntrada: resposta.usage.input_tokens,
        tokensSaida: resposta.usage.output_tokens,
        concluidoEm: new Date(),
      },
    });
    const lev = await db.levantamento.findUnique({ where: { id }, select: { criadoPorId: true, titulo: true } });
    await avisar([lev?.criadoPorId], { tipo: "projeto", titulo: `Escopo pronto: ${lev?.titulo ?? ""}`, link: `/ia/${id}` });
  } catch (e) {
    let msg = e instanceof Error ? e.message : "Erro desconhecido.";
    if (e instanceof Anthropic.AuthenticationError) msg = "Chave da API da Anthropic inválida. Confira ANTHROPIC_API_KEY.";
    else if (e instanceof Anthropic.RateLimitError) msg = "Limite de uso da IA atingido. Aguarde alguns minutos e tente de novo.";
    else if (e instanceof Anthropic.BadRequestError) msg = `A IA recusou a requisição: ${e.message.slice(0, 300)}`;
    else if (e instanceof Anthropic.APIError) msg = `Falha na API da IA (${e.status}). Tente novamente.`;
    console.error("[ia] levantamento", id, e);
    await db.levantamento.update({ where: { id }, data: { status: "ERRO", erro: msg.slice(0, 1000), concluidoEm: new Date() } });
  }
}
