"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prioridade, StatusChamado } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/auth";
import { avisar, idsGestores } from "@/lib/avisos";
import { prazosSla } from "@/lib/sla";
import { ROTULO_STATUS_CHAMADO } from "@/components/ui";
import type { EstadoForm } from "@/components/client";

const PRIORIDADES: Prioridade[] = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];
const STATUS: StatusChamado[] = ["ABERTO", "EM_ATENDIMENTO", "AGUARDANDO_CLIENTE", "RESOLVIDO", "FECHADO"];
const CANAIS = ["whatsapp", "email", "telefone", "interno"];

const texto = (fd: FormData, k: string, max = 500) => {
  const v = String(fd.get(k) ?? "").trim();
  return v ? v.slice(0, max) : null;
};

function revalidar(id?: string) {
  revalidatePath("/chamados");
  revalidatePath("/painel");
  if (id) revalidatePath(`/chamados/${id}`);
}

// Contrato de suporte ativo do cliente (define o SLA).
async function contratoVigente(clienteId: string | null) {
  if (!clienteId) return null;
  return db.contrato.findFirst({
    where: { clienteId, status: "ATIVO", tipo: { in: ["SUPORTE", "MENSALIDADE", "HORAS"] } },
    orderBy: [{ slaRespostaHoras: { sort: "asc", nulls: "last" } }, { inicio: "desc" }],
  });
}

export async function criarChamado(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const u = await exigirUsuario();
  const titulo = texto(fd, "titulo", 200);
  if (!titulo) return { erro: "Descreva o chamado em uma linha." };
  const p = String(fd.get("prioridade")) as Prioridade;
  const prioridade = PRIORIDADES.includes(p) ? p : "MEDIA";
  const canal = String(fd.get("canal"));
  let clienteId = texto(fd, "clienteId");
  const projetoId = texto(fd, "projetoId");
  if (!clienteId && projetoId) clienteId = (await db.projeto.findUnique({ where: { id: projetoId }, select: { clienteId: true } }))?.clienteId ?? null;

  const contrato = await contratoVigente(clienteId);
  const agora = new Date();
  const responsavelId = texto(fd, "responsavelId");
  const c = await db.chamado.create({
    data: {
      titulo,
      descricao: texto(fd, "descricao", 8000),
      prioridade,
      canal: CANAIS.includes(canal) ? canal : "whatsapp",
      solicitante: texto(fd, "solicitante", 120),
      clienteId,
      projetoId,
      contratoId: contrato?.id ?? null,
      responsavelId,
      status: responsavelId ? "EM_ATENDIMENTO" : "ABERTO",
      criadoPorId: u.id,
      ...prazosSla(prioridade, agora, contrato),
    },
  });
  await avisar(
    responsavelId ? [responsavelId] : await idsGestores(),
    {
      tipo: "chamado",
      titulo: `${prioridade === "URGENTE" ? "🔴 " : ""}Chamado #${c.numero}: ${c.titulo}`,
      texto: responsavelId ? "Você é o responsável." : "Novo chamado sem responsável.",
      link: `/chamados/${c.id}`,
    },
    u.id,
  );
  revalidar();
  redirect(`/chamados/${c.id}`);
}

async function carregar(id: string) {
  return db.chamado.findUniqueOrThrow({ where: { id } });
}

// Resposta pública (passada ao cliente) ou nota interna. A primeira resposta pública conta para o SLA.
export async function responderChamado(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const u = await exigirUsuario();
  const textoResp = texto(fd, "texto", 8000);
  if (!textoResp) return { erro: "Escreva a resposta." };
  const interna = fd.get("interna") === "on";
  const c = await carregar(id);
  await db.respostaChamado.create({ data: { chamadoId: id, autorId: u.id, texto: textoResp, interna } });
  const novo = String(fd.get("status") ?? "") as StatusChamado;
  await db.chamado.update({
    where: { id },
    data: {
      ...(!interna && !c.primeiraRespostaEm ? { primeiraRespostaEm: new Date() } : {}),
      ...(!c.responsavelId ? { responsavelId: u.id } : {}),
      ...(STATUS.includes(novo) && novo !== c.status ? statusDados(novo, c.resolvidoEm) : c.status === "ABERTO" ? { status: "EM_ATENDIMENTO" as const } : {}),
    },
  });
  if (STATUS.includes(novo) && novo !== c.status) await registrarSistema(id, u.id, `${u.nome.split(" ")[0]} mudou o status para ${ROTULO_STATUS_CHAMADO[novo]}.`);
  await avisar([c.responsavelId, c.criadoPorId], { tipo: "chamado", titulo: `Resposta no chamado #${c.numero}`, texto: textoResp.slice(0, 140), link: `/chamados/${id}` }, u.id);
  revalidar(id);
  return { ok: "Resposta registrada." };
}

function statusDados(status: StatusChamado, resolvidoEm: Date | null) {
  return {
    status,
    resolvidoEm: status === "RESOLVIDO" || status === "FECHADO" ? (resolvidoEm ?? new Date()) : null,
  };
}

async function registrarSistema(chamadoId: string, autorId: string, textoSistema: string) {
  await db.respostaChamado.create({ data: { chamadoId, autorId, texto: textoSistema, sistema: true, interna: true } });
}

export async function alterarStatusChamado(id: string, status: StatusChamado) {
  const u = await exigirUsuario();
  if (!STATUS.includes(status)) return;
  const c = await carregar(id);
  if (c.status === status) return;
  await db.chamado.update({ where: { id }, data: { ...statusDados(status, c.resolvidoEm), ...(!c.responsavelId ? { responsavelId: u.id } : {}) } });
  await registrarSistema(id, u.id, `${u.nome.split(" ")[0]} mudou o status para ${ROTULO_STATUS_CHAMADO[status]}.`);
  if (status === "RESOLVIDO") {
    await avisar([c.criadoPorId], { tipo: "chamado", titulo: `Chamado #${c.numero} resolvido`, texto: c.titulo, link: `/chamados/${id}` }, u.id);
  }
  revalidar(id);
}

export async function editarChamado(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const u = await exigirUsuario();
  const c = await carregar(id);
  const titulo = texto(fd, "titulo", 200);
  if (!titulo) return { erro: "O título não pode ficar vazio." };
  const p = String(fd.get("prioridade")) as Prioridade;
  const prioridade = PRIORIDADES.includes(p) ? p : c.prioridade;
  const responsavelId = texto(fd, "responsavelId");
  const clienteId = texto(fd, "clienteId");
  const contrato = clienteId !== c.clienteId || prioridade !== c.prioridade ? await contratoVigente(clienteId) : null;
  await db.chamado.update({
    where: { id },
    data: {
      titulo,
      descricao: texto(fd, "descricao", 8000),
      solicitante: texto(fd, "solicitante", 120),
      prioridade,
      clienteId,
      projetoId: texto(fd, "projetoId"),
      responsavelId,
      // Mudou a prioridade ou o cliente: recalcula o SLA a partir da abertura.
      ...(contrato !== null || prioridade !== c.prioridade ? { contratoId: contrato?.id ?? null, ...prazosSla(prioridade, c.criadoEm, contrato) } : {}),
    },
  });
  if (responsavelId && responsavelId !== c.responsavelId) {
    await avisar([responsavelId], { tipo: "chamado", titulo: `Chamado #${c.numero} com você`, texto: titulo, link: `/chamados/${id}` }, u.id);
  }
  revalidar(id);
  return { ok: "Chamado atualizado." };
}

// Vira um item no quadro (ex.: bug que precisa de correção no código).
export async function criarTarefaDoChamado(id: string) {
  const u = await exigirUsuario();
  const c = await carregar(id);
  const t = await db.tarefa.create({
    data: {
      titulo: c.titulo,
      descricao: [`Aberto a partir do chamado #${c.numero}.`, c.descricao].filter(Boolean).join("\n\n"),
      tipo: "BUG",
      prioridade: c.prioridade,
      status: "A_FAZER",
      projetoId: c.projetoId,
      responsavelId: c.responsavelId,
      chamadoId: c.id,
      criadoPorId: u.id,
    },
  });
  await registrarSistema(id, u.id, `${u.nome.split(" ")[0]} criou o item #${t.numero} no quadro.`);
  revalidar(id);
  revalidatePath("/quadro");
  revalidatePath("/tarefas");
}
