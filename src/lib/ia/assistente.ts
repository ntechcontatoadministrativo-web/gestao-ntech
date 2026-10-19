import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import type { UsuarioSessao } from "../auth";
import { etapaAtrasada, progresso, ROTULO_ACAO, STATUS_ABERTOS } from "../consultas";
import { situacaoSla } from "../sla";
import { filtroArquivosVisiveis } from "../permissoes";
import { diaBelem, estaOnline, fmtMinutos, intervaloDia } from "../utils";
import { MODELO_IA } from "./levantamento";

const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { timeZone: "America/Belem", hour: "2-digit", minute: "2-digit" });
const dataHora = (d: Date | null | undefined) =>
  d ? d.toLocaleString("pt-BR", { timeZone: "America/Belem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;
const dia = (d: Date | null | undefined) => (d ? diaBelem(d).split("-").reverse().join("/") : null);

const Periodo = {
  de: z.string().optional().describe('Primeiro dia, "YYYY-MM-DD" (fuso de Belém). Padrão: hoje.'),
  ate: z.string().optional().describe('Último dia, inclusive, "YYYY-MM-DD". Padrão: igual a "de".'),
};

function intervalo(de?: string, ate?: string): [Date, Date] {
  const ok = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const ini = ok(de) ?? diaBelem();
  const fim = ok(ate) ?? ini;
  return [intervaloDia(ini)[0], intervaloDia(fim)[1]];
}

// Ferramentas que a IA usa para consultar o sistema. Para colaboradores, tudo
// fica restrito aos dados da própria pessoa.
export function ferramentas(u: UsuarioSessao) {
  const gestor = u.perfil === "GESTOR";
  const pessoaPermitida = (id: string) => gestor || id === u.id;
  const filtroProjeto: Prisma.ProjetoWhereInput = gestor
    ? {}
    : { OR: [{ etapas: { some: { responsavelId: u.id } } }, { tarefas: { some: { responsavelId: u.id } } }, { arquivos: { some: filtroArquivosVisiveis(u.id) } }] };

  const buscarPessoas = betaZodTool({
    name: "buscar_pessoas",
    description:
      "Lista as pessoas da equipe (id, nome, cargo, perfil, se está online, último acesso). Use para descobrir o id de alguém citado pelo nome (aceita apelido ou só o primeiro nome).",
    inputSchema: z.object({ nome: z.string().optional().describe("Parte do nome para filtrar. Vazio = todos.") }),
    run: async ({ nome }) => {
      const pessoas = await db.usuario.findMany({
        where: { ...(nome ? { nome: { contains: nome.trim(), mode: "insensitive" } } : {}), ...(gestor ? {} : { id: u.id }) },
        select: { id: true, nome: true, cargo: true, perfil: true, ativo: true, ultimoAcesso: true, missao: true },
        orderBy: { nome: "asc" },
      });
      return JSON.stringify(
        pessoas.map((p) => ({ ...p, online: p.ativo && estaOnline(p.ultimoAcesso), ultimoAcesso: dataHora(p.ultimoAcesso) })),
      );
    },
  });

  const atividadePessoa = betaZodTool({
    name: "atividade_pessoa",
    description:
      "Tudo o que uma pessoa fez num período: entradas no sistema, arquivos abertos/baixados/enviados, revisões, comentários, mudanças de status de etapas, etapas concluídas, tarefas criadas/concluídas e horas apontadas. Use para perguntas como 'o que o Yuri fez hoje?'.",
    inputSchema: z.object({ pessoa_id: z.string(), ...Periodo }),
    run: async ({ pessoa_id, de, ate }) => {
      if (!pessoaPermitida(pessoa_id)) return "Sem permissão: colaboradores só consultam a própria atividade.";
      const [ini, fim] = intervalo(de, ate);
      const periodo = { gte: ini, lt: fim };
      const [pessoa, logs, comentarios, etapasConcluidas, tarefasFeitas, tarefasRecebidas, horas] = await Promise.all([
        db.usuario.findUnique({ where: { id: pessoa_id }, select: { nome: true, ultimoAcesso: true } }),
        db.logAcesso.findMany({
          where: { usuarioId: pessoa_id, criadoEm: periodo },
          include: { arquivo: { select: { nome: true, projeto: { select: { codigo: true } } } }, versao: { select: { revisao: true } } },
          orderBy: { criadoEm: "asc" },
          take: 300,
        }),
        db.comentario.findMany({
          where: { autorId: pessoa_id, criadoEm: periodo },
          include: { etapa: { select: { nome: true, projeto: { select: { codigo: true, nome: true } } } } },
          orderBy: { criadoEm: "asc" },
          take: 200,
        }),
        db.etapa.findMany({
          where: { responsavelId: pessoa_id, concluidaEm: periodo },
          select: { nome: true, prazo: true, concluidaEm: true, projeto: { select: { codigo: true } } },
        }),
        db.tarefa.findMany({ where: { responsavelId: pessoa_id, concluidaEm: periodo }, select: { numero: true, titulo: true, tipo: true, pontos: true, prazo: true, concluidaEm: true } }),
        db.tarefa.findMany({ where: { responsavelId: pessoa_id, criadoEm: periodo }, select: { titulo: true, status: true, prazo: true } }),
        db.apontamento.findMany({
          where: { usuarioId: pessoa_id, data: periodo },
          include: { projeto: { select: { codigo: true } }, etapa: { select: { nome: true } }, tarefa: { select: { titulo: true } } },
        }),
      ]);
      if (!pessoa) return "Pessoa não encontrada.";
      return JSON.stringify({
        pessoa: pessoa.nome,
        periodo: `${dia(ini)} a ${dia(new Date(fim.getTime() - 1))}`,
        ultimoAcesso: dataHora(pessoa.ultimoAcesso),
        eventos_arquivos_e_acesso: logs.map((l) => ({
          hora: dataHora(l.criadoEm),
          acao: ROTULO_ACAO[l.acao],
          arquivo: l.arquivo ? `${l.arquivo.projeto.codigo} · ${l.arquivo.nome}${l.versao ? ` R${String(l.versao.revisao).padStart(2, "0")}` : ""}` : undefined,
          detalhe: l.detalhe ?? undefined,
        })),
        comentarios_e_mudancas_de_etapa: comentarios.map((c) => ({
          hora: dataHora(c.criadoEm),
          projeto: c.etapa.projeto.codigo,
          etapa: c.etapa.nome,
          tipo: c.sistema ? "ação no fluxo" : "comentário",
          texto: c.texto.slice(0, 300),
        })),
        etapas_concluidas: etapasConcluidas.map((e) => ({
          projeto: e.projeto.codigo,
          etapa: e.nome,
          concluida: dataHora(e.concluidaEm),
          no_prazo: e.prazo ? e.concluidaEm! <= new Date(e.prazo.getTime() + 12 * 3600 * 1000) : null,
        })),
        itens_concluidos: tarefasFeitas.map((t) => ({ numero: `#${t.numero}`, titulo: t.titulo, tipo: t.tipo, pontos: t.pontos, concluido: dataHora(t.concluidaEm) })),
        itens_recebidos: tarefasRecebidas.map((t) => ({ titulo: t.titulo, status: t.status, prazo: dia(t.prazo) })),
        horas_apontadas: {
          total: fmtMinutos(horas.reduce((s, h) => s + h.minutos, 0)),
          itens: horas.map((h) => ({
            dia: dia(h.data),
            horas: fmtMinutos(h.minutos),
            projeto: h.projeto.codigo,
            etapa: h.etapa?.nome,
            tarefa: h.tarefa?.titulo,
            descricao: h.descricao ?? undefined,
          })),
        },
      });
    },
  });

  const listarProjetos = betaZodTool({
    name: "listar_projetos",
    description: "Lista projetos com status, progresso (%), etapa atual, prazo final e quantidade de etapas atrasadas.",
    inputSchema: z.object({
      status: z.enum(["ATIVO", "PAUSADO", "CONCLUIDO", "CANCELADO", "TODOS"]).optional().describe("Padrão: ATIVO"),
      busca: z.string().optional().describe("Parte do nome, código ou cliente"),
    }),
    run: async ({ status, busca }) => {
      const projetos = await db.projeto.findMany({
        where: {
          AND: [
            filtroProjeto,
            !status || status === "ATIVO" ? { status: "ATIVO" } : status === "TODOS" ? {} : { status },
            busca
              ? { OR: [{ nome: { contains: busca, mode: "insensitive" } }, { codigo: { contains: busca, mode: "insensitive" } }, { cliente: { contains: busca, mode: "insensitive" } }] }
              : {},
          ],
        },
        include: { etapas: { select: { nome: true, status: true, prazo: true, ordem: true } } },
        orderBy: { codigo: "desc" },
        take: 60,
      });
      return JSON.stringify(
        projetos.map((p) => ({
          id: p.id,
          codigo: p.codigo,
          nome: p.nome,
          cliente: p.cliente,
          status: p.status,
          progresso: `${progresso(p.etapas)}%`,
          etapa_atual: p.etapas.sort((a, b) => a.ordem - b.ordem).find((e) => e.status !== "CONCLUIDA")?.nome ?? null,
          prazo_final: dia(p.prazoFinal),
          etapas_atrasadas: p.etapas.filter(etapaAtrasada).length,
        })),
      );
    },
  });

  const detalhesProjeto = betaZodTool({
    name: "detalhes_projeto",
    description: "Detalhes de um projeto: etapas (responsável, status, prazo, horas), tarefas abertas, últimos arquivos e horas totais.",
    inputSchema: z.object({ projeto: z.string().describe("id ou código do projeto (ex.: P2026-001)") }),
    run: async ({ projeto }) => {
      const p = await db.projeto.findFirst({
        where: { AND: [filtroProjeto, { OR: [{ id: projeto }, { codigo: { equals: projeto.trim(), mode: "insensitive" } }] }] },
        include: {
          etapas: { include: { responsavel: { select: { nome: true } }, apontamentos: { select: { minutos: true } } }, orderBy: { ordem: "asc" } },
          tarefas: { where: { status: { in: [...STATUS_ABERTOS, "BACKLOG"] } }, include: { responsavel: { select: { nome: true } } } },
          sprints: { where: { status: "ATIVA" }, include: { tarefas: { select: { status: true, pontos: true } } } },
          ambientes: { include: { deploys: { orderBy: { criadoEm: "desc" }, take: 1 } } },
          arquivos: { orderBy: { atualizadoEm: "desc" }, take: 10, select: { nome: true, revisaoAtual: true, atualizadoEm: true } },
          apontamentos: { select: { minutos: true } },
        },
      });
      if (!p) return "Projeto não encontrado (ou sem acesso).";
      const etapas = gestor ? p.etapas : p.etapas.filter((e) => e.responsavelId === u.id);
      return JSON.stringify({
        codigo: p.codigo,
        nome: p.nome,
        cliente: p.cliente,
        tipo: p.tipo,
        repositorio: p.repositorio,
        stack: p.stack,
        status: p.status,
        inicio: dia(p.dataInicio),
        sprint_ativa: p.sprints[0]
          ? {
              nome: p.sprints[0].nome,
              fim: dia(p.sprints[0].fim),
              pontos_feitos: p.sprints[0].tarefas.filter((t) => t.status === "FEITA").reduce((a, t) => a + (t.pontos ?? 0), 0),
              pontos_total: p.sprints[0].tarefas.reduce((a, t) => a + (t.pontos ?? 0), 0),
            }
          : null,
        ambientes: p.ambientes.map((a) => ({ nome: a.nome, url: a.url, ultimo_deploy: a.deploys[0] ? `${a.deploys[0].versao} em ${dataHora(a.deploys[0].criadoEm)}` : null })),
        prazo_final: dia(p.prazoFinal),
        progresso: `${progresso(p.etapas)}%`,
        horas_totais: fmtMinutos(p.apontamentos.reduce((s, a) => s + a.minutos, 0)),
        etapas: etapas.map((e) => ({
          ordem: e.ordem,
          nome: e.nome,
          responsavel: e.responsavel?.nome ?? null,
          status: e.status,
          prazo: dia(e.prazo),
          atrasada: etapaAtrasada(e),
          concluida_em: dia(e.concluidaEm),
          horas: fmtMinutos(e.apontamentos.reduce((s, a) => s + a.minutos, 0)),
        })),
        itens_abertos: p.tarefas
          .filter((t) => gestor || !t.responsavelId || t.responsavelId === u.id)
          .map((t) => ({ numero: `#${t.numero}`, titulo: t.titulo, tipo: t.tipo, status: t.status, pontos: t.pontos, responsavel: t.responsavel?.nome ?? null, prioridade: t.prioridade, prazo: dia(t.prazo) })),
        ultimos_arquivos: gestor ? p.arquivos.map((a) => ({ nome: a.nome, revisao: `R${String(a.revisaoAtual).padStart(2, "0")}`, atualizado: dataHora(a.atualizadoEm) })) : undefined,
      });
    },
  });

  const buscarTarefas = betaZodTool({
    name: "buscar_tarefas",
    description: "Busca itens do quadro (features, bugs, tarefas) por responsável, status e atraso. ABERTAS = a fazer, fazendo e em revisão.",
    inputSchema: z.object({
      responsavel_id: z.string().optional(),
      status: z.enum(["ABERTAS", "BACKLOG", "A_FAZER", "FAZENDO", "REVISAO", "FEITA", "CANCELADA", "TODAS"]).optional().describe("Padrão: ABERTAS"),
      tipo: z.enum(["FEATURE", "BUG", "MELHORIA", "TAREFA", "PESQUISA"]).optional(),
      somente_atrasadas: z.boolean().optional(),
    }),
    run: async ({ responsavel_id, status, tipo, somente_atrasadas }) => {
      const resp = gestor ? responsavel_id : u.id;
      const st = status ?? "ABERTAS";
      const tarefas = await db.tarefa.findMany({
        where: {
          ...(resp ? { responsavelId: resp } : {}),
          ...(st === "ABERTAS" ? { status: { in: STATUS_ABERTOS } } : st === "TODAS" ? {} : { status: st }),
          ...(tipo ? { tipo } : {}),
          ...(somente_atrasadas ? { prazo: { lt: intervaloDia(diaBelem())[0] }, status: { in: STATUS_ABERTOS } } : {}),
        },
        include: { responsavel: { select: { nome: true } }, projeto: { select: { codigo: true } } },
        orderBy: { prazo: "asc" },
        take: 100,
      });
      return JSON.stringify(
        tarefas.map((t) => ({
          numero: `#${t.numero}`,
          titulo: t.titulo,
          tipo: t.tipo,
          pontos: t.pontos,
          responsavel: t.responsavel?.nome ?? null,
          status: t.status,
          prioridade: t.prioridade,
          prazo: dia(t.prazo),
          projeto: t.projeto?.codigo,
          concluida: dataHora(t.concluidaEm),
        })),
      );
    },
  });

  const horasApontadas = betaZodTool({
    name: "horas_apontadas",
    description: "Soma das horas apontadas num período, agrupadas por pessoa e por projeto. Pode filtrar por pessoa ou projeto.",
    inputSchema: z.object({ pessoa_id: z.string().optional(), projeto: z.string().optional().describe("id ou código"), ...Periodo }),
    run: async ({ pessoa_id, projeto, de, ate }) => {
      const [ini, fim] = intervalo(de, ate);
      const pid = gestor ? pessoa_id : u.id;
      const proj = projeto ? await db.projeto.findFirst({ where: { OR: [{ id: projeto }, { codigo: { equals: projeto, mode: "insensitive" } }] } }) : null;
      const itens = await db.apontamento.findMany({
        where: { data: { gte: ini, lt: fim }, ...(pid ? { usuarioId: pid } : {}), ...(proj ? { projetoId: proj.id } : {}) },
        include: { usuario: { select: { nome: true } }, projeto: { select: { codigo: true } } },
      });
      const soma = (k: (a: (typeof itens)[number]) => string) => {
        const m = new Map<string, number>();
        for (const a of itens) m.set(k(a), (m.get(k(a)) ?? 0) + a.minutos);
        return Object.fromEntries(Array.from(m, ([c, v]) => [c, fmtMinutos(v)]));
      };
      return JSON.stringify({
        periodo: `${dia(ini)} a ${dia(new Date(fim.getTime() - 1))}`,
        total: fmtMinutos(itens.reduce((s, a) => s + a.minutos, 0)),
        por_pessoa: soma((a) => a.usuario.nome),
        por_projeto: soma((a) => a.projeto.codigo),
      });
    },
  });

  const pendencias = betaZodTool({
    name: "pendencias",
    description:
      "Visão geral do que precisa de atenção: itens em revisão (code review), chamados com SLA estourado ou perto, etapas aguardando aprovação, etapas atrasadas ou vencendo em até 3 dias e itens atrasados.",
    inputSchema: z.object({}),
    run: async () => {
      const hoje = intervaloDia(diaBelem())[0];
      const em3 = new Date(hoje.getTime() + 4 * 86400000);
      const base: Prisma.EtapaWhereInput = { projeto: { status: "ATIVO" }, ...(gestor ? {} : { responsavelId: u.id }) };
      const [aguardando, atrasadas, vencendo, tarefas, revisao, chamados] = await Promise.all([
        db.etapa.findMany({ where: { ...base, status: "AGUARDANDO_APROVACAO" }, include: { projeto: { select: { codigo: true } }, responsavel: { select: { nome: true } } } }),
        db.etapa.findMany({ where: { ...base, status: { not: "CONCLUIDA" }, prazo: { lt: hoje } }, include: { projeto: { select: { codigo: true } }, responsavel: { select: { nome: true } } } }),
        db.etapa.findMany({ where: { ...base, status: { not: "CONCLUIDA" }, prazo: { gte: hoje, lt: em3 } }, include: { projeto: { select: { codigo: true } }, responsavel: { select: { nome: true } } } }),
        db.tarefa.findMany({
          where: { status: { in: STATUS_ABERTOS }, prazo: { lt: hoje }, ...(gestor ? {} : { responsavelId: u.id }) },
          include: { responsavel: { select: { nome: true } } },
        }),
        db.tarefa.findMany({ where: { status: "REVISAO", ...(gestor ? {} : { responsavelId: u.id }) }, include: { responsavel: { select: { nome: true } } } }),
        db.chamado.findMany({
          where: { status: { in: ["ABERTO", "EM_ATENDIMENTO", "AGUARDANDO_CLIENTE"] }, ...(gestor ? {} : { OR: [{ responsavelId: u.id }, { responsavelId: null }] }) },
          include: { cliente: { select: { nome: true } }, responsavel: { select: { nome: true } } },
        }),
      ]);
      const fmt = (e: (typeof aguardando)[number]) => ({ projeto: e.projeto.codigo, etapa: e.nome, responsavel: e.responsavel?.nome ?? null, prazo: dia(e.prazo) });
      return JSON.stringify({
        aguardando_aprovacao: aguardando.map(fmt),
        etapas_atrasadas: atrasadas.map(fmt),
        etapas_vencendo_em_3_dias: vencendo.map(fmt),
        itens_atrasados: tarefas.map((t) => ({ numero: `#${t.numero}`, titulo: t.titulo, responsavel: t.responsavel?.nome ?? null, prazo: dia(t.prazo) })),
        itens_em_revisao: revisao.map((t) => ({ numero: `#${t.numero}`, titulo: t.titulo, responsavel: t.responsavel?.nome ?? null })),
        chamados_atencao: chamados
          .map((c) => ({ c, sla: situacaoSla(c) }))
          .filter(({ sla }) => sla && sla.nivel !== "ok")
          .map(({ c, sla }) => ({ numero: `#${c.numero}`, titulo: c.titulo, cliente: c.cliente?.nome ?? null, responsavel: c.responsavel?.nome ?? "fila", sla })),
      });
    },
  });

  const acessosArquivo = betaZodTool({
    name: "acessos_arquivo",
    description: "Quem abriu, baixou ou teve acesso negado a arquivos cujo nome contém o texto informado (auditoria). Só para gestores.",
    inputSchema: z.object({ nome_arquivo: z.string(), ...Periodo }),
    run: async ({ nome_arquivo, de, ate }) => {
      if (!gestor) return "Sem permissão: a auditoria de arquivos é só para gestores.";
      const [ini, fim] = de || ate ? intervalo(de, ate) : [new Date(0), new Date(Date.now() + 86400000)];
      const logs = await db.logAcesso.findMany({
        where: { arquivo: { nome: { contains: nome_arquivo, mode: "insensitive" } }, criadoEm: { gte: ini, lt: fim } },
        include: { usuario: { select: { nome: true } }, arquivo: { select: { nome: true } }, versao: { select: { revisao: true } } },
        orderBy: { criadoEm: "desc" },
        take: 80,
      });
      return JSON.stringify(
        logs.map((l) => ({
          quando: dataHora(l.criadoEm),
          pessoa: l.usuario?.nome ?? l.detalhe,
          acao: ROTULO_ACAO[l.acao],
          arquivo: l.arquivo?.nome,
          revisao: l.versao ? `R${String(l.versao.revisao).padStart(2, "0")}` : undefined,
        })),
      );
    },
  });

  const buscarChamados = betaZodTool({
    name: "buscar_chamados",
    description: "Chamados de suporte com cliente, prioridade, status, responsável e situação do SLA (estourado / alerta / ok).",
    inputSchema: z.object({
      status: z.enum(["ABERTOS", "ABERTO", "EM_ATENDIMENTO", "AGUARDANDO_CLIENTE", "RESOLVIDO", "FECHADO", "TODOS"]).optional().describe("Padrão: ABERTOS"),
      cliente: z.string().optional().describe("Parte do nome do cliente"),
      responsavel_id: z.string().optional(),
      somente_sla_estourado: z.boolean().optional(),
    }),
    run: async ({ status, cliente, responsavel_id, somente_sla_estourado }) => {
      const st = status ?? "ABERTOS";
      const lista = await db.chamado.findMany({
        where: {
          ...(st === "ABERTOS" ? { status: { in: ["ABERTO", "EM_ATENDIMENTO", "AGUARDANDO_CLIENTE"] } } : st === "TODOS" ? {} : { status: st }),
          ...(cliente ? { cliente: { nome: { contains: cliente, mode: "insensitive" } } } : {}),
          ...(responsavel_id ? { responsavelId: responsavel_id } : {}),
        },
        include: { cliente: { select: { nome: true } }, responsavel: { select: { nome: true } }, projeto: { select: { codigo: true } } },
        orderBy: { criadoEm: "desc" },
        take: 80,
      });
      return JSON.stringify(
        lista
          .map((c) => ({ c, sla: situacaoSla(c) }))
          .filter(({ sla }) => !somente_sla_estourado || sla?.nivel === "estourado")
          .map(({ c, sla }) => ({
            numero: `#${c.numero}`,
            titulo: c.titulo,
            cliente: c.cliente?.nome ?? null,
            projeto: c.projeto?.codigo ?? null,
            prioridade: c.prioridade,
            status: c.status,
            responsavel: c.responsavel?.nome ?? "fila",
            aberto_em: dataHora(c.criadoEm),
            resolvido_em: dataHora(c.resolvidoEm),
            sla,
          })),
      );
    },
  });

  const deploysRecentes = betaZodTool({
    name: "deploys_recentes",
    description: "Deploys registrados (versão, projeto, ambiente, resultado, autor e changelog) num período.",
    inputSchema: z.object({ projeto: z.string().optional().describe("id ou código"), ...Periodo }),
    run: async ({ projeto, de, ate }) => {
      const [ini, fim] = de || ate ? intervalo(de, ate) : [new Date(Date.now() - 30 * 86400000), new Date(Date.now() + 86400000)];
      const lista = await db.deploy.findMany({
        where: {
          criadoEm: { gte: ini, lt: fim },
          projeto: { AND: [filtroProjeto, projeto ? { OR: [{ id: projeto }, { codigo: { equals: projeto.trim(), mode: "insensitive" } }] } : {}] },
        },
        include: { projeto: { select: { codigo: true } }, ambiente: { select: { nome: true } }, autor: { select: { nome: true } } },
        orderBy: { criadoEm: "desc" },
        take: 60,
      });
      return JSON.stringify(
        lista.map((d) => ({ quando: dataHora(d.criadoEm), projeto: d.projeto.codigo, versao: d.versao, ambiente: d.ambiente?.nome ?? null, status: d.status, autor: d.autor?.nome ?? null, notas: d.notas?.slice(0, 600) })),
      );
    },
  });

  const resumoClientes = betaZodTool({
    name: "resumo_clientes",
    description: "Carteira de clientes: contratos ativos, receita recorrente mensal (MRR), propostas e chamados abertos. Só para gestores.",
    inputSchema: z.object({ cliente: z.string().optional().describe("Parte do nome para filtrar") }),
    run: async ({ cliente }) => {
      if (!gestor) return "Sem permissão: dados financeiros são só para gestores.";
      const clientes = await db.cliente.findMany({
        where: cliente ? { nome: { contains: cliente, mode: "insensitive" } } : { ativo: true },
        include: { contratos: true, chamados: { where: { status: { in: ["ABERTO", "EM_ATENDIMENTO", "AGUARDANDO_CLIENTE"] } }, select: { id: true } } },
      });
      const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const linhas = clientes.map((c) => {
        const ativos = c.contratos.filter((x) => x.status === "ATIVO");
        const mrr = ativos.filter((x) => x.tipo !== "PROJETO").reduce((s, x) => s + x.valorCentavos, 0);
        return {
          cliente: c.nome,
          mrr: brl(mrr),
          mrr_centavos: mrr,
          contratos_ativos: ativos.map((x) => ({ titulo: x.titulo, tipo: x.tipo, valor: brl(x.valorCentavos), fim: dia(x.fim) })),
          propostas: c.contratos.filter((x) => x.status === "PROPOSTA").map((x) => ({ titulo: x.titulo, valor: brl(x.valorCentavos) })),
          chamados_abertos: c.chamados.length,
        };
      });
      return JSON.stringify({ mrr_total: brl(linhas.reduce((s, l) => s + l.mrr_centavos, 0)), clientes: linhas });
    },
  });

  return [buscarPessoas, atividadePessoa, listarProjetos, detalhesProjeto, buscarTarefas, horasApontadas, pendencias, acessosArquivo, buscarChamados, deploysRecentes, resumoClientes];
}

function sistema(u: UsuarioSessao) {
  const agora = new Date();
  const hoje = diaBelem(agora);
  const semana = agora.toLocaleDateString("pt-BR", { timeZone: "America/Belem", weekday: "long" });
  return `Você é o assistente interno da NTECH, uma empresa de tecnologia em Belém (PA) que desenvolve software sob medida, sites, produtos próprios (SaaS) e presta suporte a clientes.
O sistema organiza projetos, sprints, o quadro de itens (features, bugs, melhorias), chamados de suporte com SLA, deploys, clientes/contratos e horas.
Responda em português do Brasil, de forma direta e organizada (listas curtas, negrito nos nomes e números importantes). Sem enrolação.

Contexto:
- Hoje é ${semana}, ${hoje.split("-").reverse().join("/")} (${hoje}); agora são ${hora(agora)} no horário de Belém. Interprete "hoje", "ontem", "essa semana" (segunda a hoje) e "mês" a partir disso.
- Quem está perguntando: ${u.nome} (${u.perfil === "GESTOR" ? "gestor, vê toda a equipe" : "colaborador, só pode ver os próprios dados"}).

Como trabalhar:
- Use as ferramentas para buscar os dados reais antes de responder. Nunca invente atividades, números ou nomes.
- Quando citarem uma pessoa pelo nome, primeiro use buscar_pessoas para achar o id; se houver mais de uma pessoa com aquele nome, pergunte qual.
- Para "o que fulano fez", use atividade_pessoa e conte a história do dia em ordem cronológica, agrupando por projeto: itens concluídos (com #número), etapas que andaram, arquivos, comentários e horas. Termine com um resumo de uma linha.
- Cite itens e chamados pelo número (#123). Para "como está a sprint", use detalhes_projeto do projeto em questão (ou listar_projetos para achar os que têm sprint ativa).
- Se não houver registro no período, diga isso claramente (o sistema só sabe o que foi feito por dentro dele).
- Se a pergunta pedir algo que o perfil da pessoa não permite, explique de forma educada.`;
}

export type MensagemChat = { papel: "usuario" | "assistente"; texto: string };

// Cada pergunta vira uma conversa nova de uma única mensagem, levando o histórico
// recente como texto. Assim nada da conversa anterior é reenviado alterado.
export async function perguntarAssistente(u: UsuarioSessao, historico: MensagemChat[], pergunta: string) {
  const anteriores = historico.slice(-10);
  const contexto = anteriores.length
    ? `<conversa_anterior>\n${anteriores.map((m) => `${m.papel === "usuario" ? "Usuário" : "Assistente"}: ${m.texto.slice(0, 2000)}`).join("\n\n")}\n</conversa_anterior>\n\n`
    : "";

  const usadas: string[] = [];
  const tools = ferramentas(u).map((t) => ({
    ...t,
    run: async (input: never) => {
      usadas.push(t.name);
      return (t.run as (i: never) => Promise<string>)(input);
    },
  }));

  const resposta = await new Anthropic().beta.messages.toolRunner({
    model: MODELO_IA,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    max_iterations: 12,
    system: sistema(u),
    tools,
    messages: [{ role: "user", content: `${contexto}Pergunta: ${pergunta}` }],
  });

  if (resposta.stop_reason === "refusal") {
    return { texto: "Não consegui responder essa pergunta. Tente reformular.", ferramentas: usadas };
  }
  const texto = resposta.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { texto: texto || "Não encontrei uma resposta. Tente perguntar de outro jeito.", ferramentas: Array.from(new Set(usadas)) };
}
