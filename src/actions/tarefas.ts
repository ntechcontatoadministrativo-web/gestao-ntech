"use server";

import { revalidatePath } from "next/cache";
import type { Prioridade, StatusTarefa, TipoTarefa } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirGestor, exigirUsuario, urlBase } from "@/lib/auth";
import { parseDataInput } from "@/lib/utils";
import { mensagemTarefa } from "@/lib/whatsapp";
import { enviarWhatsapp, whatsappApiAtiva } from "@/lib/whatsapp-api";
import { avisar, idsGestores } from "@/lib/avisos";
import { fmtData } from "@/lib/utils";
import type { EstadoForm } from "@/components/client";

const PRIORIDADES: Prioridade[] = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];
const STATUS: StatusTarefa[] = ["BACKLOG", "A_FAZER", "FAZENDO", "REVISAO", "FEITA", "CANCELADA"];
const TIPOS: TipoTarefa[] = ["FEATURE", "BUG", "MELHORIA", "TAREFA", "PESQUISA"];
const PONTOS = [1, 2, 3, 5, 8, 13, 21];

const texto = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v || null;
};

function revalidar(projetoId?: string | null) {
  revalidatePath("/tarefas");
  revalidatePath("/quadro");
  revalidatePath("/painel");
  if (projetoId) revalidatePath(`/projetos/${projetoId}`);
}

async function dadosDoForm(fd: FormData) {
  const titulo = texto(fd, "titulo");
  if (!titulo) return { erro: "Informe o título." } as const;

  const etapaId = texto(fd, "etapaId");
  let projetoId = texto(fd, "projetoId");
  if (etapaId) {
    const etapa = await db.etapa.findUnique({ where: { id: etapaId }, select: { projetoId: true } });
    if (!etapa) return { erro: "Etapa inválida." } as const;
    projetoId = etapa.projetoId;
  }
  let sprintId = texto(fd, "sprintId");
  if (sprintId) {
    const sprint = await db.sprint.findUnique({ where: { id: sprintId }, select: { projetoId: true } });
    if (!sprint || sprint.projetoId !== projetoId) sprintId = null;
  }
  const p = String(fd.get("prioridade")) as Prioridade;
  const tipo = String(fd.get("tipo")) as TipoTarefa;
  const pontos = Number(fd.get("pontos"));
  const linkPr = texto(fd, "linkPr");
  return {
    dados: {
      titulo: titulo.slice(0, 200),
      descricao: texto(fd, "descricao")?.slice(0, 8000) ?? null,
      responsavelId: texto(fd, "responsavelId"),
      projetoId,
      etapaId,
      sprintId,
      tipo: TIPOS.includes(tipo) ? tipo : "TAREFA",
      pontos: PONTOS.includes(pontos) ? pontos : null,
      linkPr: linkPr && /^https?:\/\//.test(linkPr) ? linkPr.slice(0, 500) : null,
      prazo: parseDataInput(fd.get("prazo")),
      prioridade: PRIORIDADES.includes(p) ? p : "MEDIA",
    },
  } as const;
}

// Status inicial: com sprint ou responsável já entra em "A fazer"; senão vai para o backlog.
function statusInicial(fd: FormData, d: { responsavelId: string | null; sprintId: string | null }): StatusTarefa {
  const pedido = String(fd.get("status") ?? "") as StatusTarefa;
  if (STATUS.includes(pedido) && pedido !== "CANCELADA") return pedido;
  return d.responsavelId || d.sprintId ? "A_FAZER" : "BACKLOG";
}

// Cria o item. Se o gestor designou para alguém, devolve a mensagem de WhatsApp pronta.
export async function criarTarefa(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const u = await exigirUsuario();
  const gestor = u.perfil === "GESTOR";
  const r = await dadosDoForm(fd);
  if ("erro" in r) return { erro: r.erro };
  // Colaborador abre item para si ou deixa no backlog; designar para outra pessoa é com o gestor.
  if (!gestor && r.dados.responsavelId && r.dados.responsavelId !== u.id) return { erro: "Você só pode designar itens para você mesmo." };

  const t = await db.tarefa.create({
    data: { ...r.dados, status: statusInicial(fd, r.dados), criadoPorId: u.id },
    include: {
      responsavel: { select: { nome: true, telefone: true, missao: true, modeloWhatsapp: true } },
      criadoPor: { select: { nome: true } },
      projeto: { select: { codigo: true, nome: true, cliente: true } },
      etapa: { select: { nome: true } },
    },
  });
  revalidar(t.projetoId);

  if (!t.responsavel || !t.responsavelId) return { ok: `Item #${t.numero} criado no backlog.`, dados: { tarefaId: t.id, numero: String(t.numero) } };
  await avisar(
    [t.responsavelId],
    {
      tipo: "tarefa",
      titulo: `#${t.numero} para você: ${t.titulo}`,
      texto: [t.projeto ? `${t.projeto.codigo} · ${t.projeto.nome}` : null, t.prazo ? `prazo ${fmtData(t.prazo)}` : null].filter(Boolean).join(" · ") || null,
      link: `/tarefas?t=${t.id}#${t.id}`,
    },
    u.id,
  );
  if (!gestor || t.responsavelId === u.id) return { ok: `Item #${t.numero} criado.`, dados: { tarefaId: t.id, numero: String(t.numero) } };

  const mensagem = mensagemTarefa({ ...t, responsavel: t.responsavel, url: `${urlBase()}/tarefas?t=${t.id}` });
  // Envio automático pela API, se o gestor marcou a opção.
  let envio = "";
  if (fd.get("enviarAuto") === "on" && whatsappApiAtiva()) {
    const env = await enviarWhatsapp({ usuarioId: t.responsavelId, telefone: t.responsavel.telefone, mensagem, referencia: `tarefa:${t.id}` });
    envio = env.ok ? "enviado" : env.erro;
    if (env.ok) await db.tarefa.update({ where: { id: t.id }, data: { avisadoEm: new Date() } });
  }
  return {
    ok: `Item #${t.numero} designado para ${t.responsavel.nome}.`,
    dados: {
      tarefaId: t.id,
      numero: String(t.numero),
      usuarioId: t.responsavelId,
      nome: t.responsavel.nome,
      telefone: t.responsavel.telefone ?? "",
      mensagem,
      envio,
      apiAtiva: whatsappApiAtiva() ? "1" : "",
    },
  };
}

const podeEditar = (u: { id: string; perfil: string }, t: { responsavelId: string | null; criadoPorId: string | null }) =>
  u.perfil === "GESTOR" || t.responsavelId === u.id || t.criadoPorId === u.id;

export async function editarTarefa(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const u = await exigirUsuario();
  const atual = await db.tarefa.findUniqueOrThrow({ where: { id } });
  if (!podeEditar(u, atual)) return { erro: "Você não pode editar este item." };
  const r = await dadosDoForm(fd);
  if ("erro" in r) return { erro: r.erro };
  if (u.perfil !== "GESTOR" && r.dados.responsavelId && r.dados.responsavelId !== u.id && r.dados.responsavelId !== atual.responsavelId) {
    return { erro: "Só o gestor designa itens para outra pessoa." };
  }
  const t = await db.tarefa.update({ where: { id }, data: r.dados });
  if (t.responsavelId && t.responsavelId !== atual.responsavelId) {
    await avisar([t.responsavelId], { tipo: "tarefa", titulo: `#${t.numero} para você: ${t.titulo}`, link: `/tarefas?t=${t.id}#${t.id}` }, u.id);
  }
  revalidar(t.projetoId);
  return { ok: "Item atualizado." };
}

// Move o item no quadro. Quem puxa um item sem dono para fora do backlog vira o responsável.
export async function alterarStatusTarefa(id: string, status: StatusTarefa) {
  const u = await exigirUsuario();
  if (!STATUS.includes(status)) return;
  const t = await db.tarefa.findUniqueOrThrow({ where: { id } });
  const gestor = u.perfil === "GESTOR";
  const semDono = !t.responsavelId;
  if (!gestor && !semDono && t.responsavelId !== u.id) throw new Error("Este item é de outra pessoa.");
  if (!gestor && status === "CANCELADA") throw new Error("Só o gestor cancela itens.");

  const assumir = semDono && !gestor && status !== "BACKLOG";
  await db.tarefa.update({
    where: { id },
    data: {
      status,
      concluidaEm: status === "FEITA" ? (t.concluidaEm ?? new Date()) : null,
      ...(assumir ? { responsavelId: u.id } : {}),
    },
  });
  const nome = u.nome.split(" ")[0];
  if (status === "REVISAO" && t.status !== "REVISAO") {
    await avisar(await idsGestores(), { tipo: "aprovacao", titulo: `#${t.numero} pronto para revisão`, texto: `${nome}: ${t.titulo}`, link: `/quadro` }, u.id);
  }
  if (status === "FEITA" && t.status !== "FEITA") {
    await avisar([t.criadoPorId], { tipo: "tarefa", titulo: `${nome} concluiu #${t.numero}: ${t.titulo}`, link: `/tarefas?t=${t.id}#${t.id}` }, u.id);
  }
  revalidar(t.projetoId);
}

// "Pegar" um item sem dono.
export async function pegarTarefa(id: string) {
  const u = await exigirUsuario();
  const t = await db.tarefa.findUniqueOrThrow({ where: { id } });
  if (t.responsavelId && t.responsavelId !== u.id) throw new Error("Outra pessoa já pegou este item.");
  await db.tarefa.update({ where: { id }, data: { responsavelId: u.id, status: t.status === "BACKLOG" ? "A_FAZER" : t.status } });
  revalidar(t.projetoId);
}

export async function excluirTarefa(id: string) {
  await exigirGestor();
  const t = await db.tarefa.delete({ where: { id } });
  revalidar(t.projetoId);
}

export async function registrarAviso(id: string) {
  await exigirGestor();
  await db.tarefa.update({ where: { id }, data: { avisadoEm: new Date() } });
  revalidatePath("/tarefas");
}
