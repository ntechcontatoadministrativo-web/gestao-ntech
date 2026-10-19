"use server";

import { revalidatePath } from "next/cache";
import type { StatusEtapa } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirGestor, exigirUsuario, type UsuarioSessao } from "@/lib/auth";
import { parseDataInput } from "@/lib/utils";
import type { EstadoForm } from "@/components/client";
import { avisar, idsGestores } from "@/lib/avisos";

const texto = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v || null;
};

function revalidar(projetoId: string, etapaId?: string) {
  revalidatePath(`/projetos/${projetoId}`);
  if (etapaId) revalidatePath(`/projetos/${projetoId}/etapas/${etapaId}`);
  revalidatePath("/painel");
}

async function etapaComAcesso(id: string, usuario: UsuarioSessao) {
  const etapa = await db.etapa.findUnique({ where: { id } });
  if (!etapa) throw new Error("Etapa não encontrada.");
  const ehResponsavel = etapa.responsavelId === usuario.id;
  if (usuario.perfil !== "GESTOR" && !ehResponsavel) throw new Error("Você não é responsável por esta etapa.");
  return etapa;
}

async function comentarioSistema(etapaId: string, autorId: string, texto: string) {
  await db.comentario.create({ data: { etapaId, autorId, texto, sistema: true } });
}

export async function criarEtapa(projetoId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const gestor = await exigirGestor();
  const nome = texto(fd, "nome");
  if (!nome) return { erro: "Informe o nome da etapa." };
  const ultima = await db.etapa.findFirst({ where: { projetoId }, orderBy: { ordem: "desc" } });
  const nova = await db.etapa.create({
    data: {
      projetoId,
      nome,
      descricao: texto(fd, "descricao"),
      responsavelId: texto(fd, "responsavelId"),
      prazo: parseDataInput(fd.get("prazo")),
      ordem: (ultima?.ordem ?? 0) + 1,
    },
    include: { projeto: { select: { codigo: true, nome: true } } },
  });
  await avisar(
    [nova.responsavelId],
    { tipo: "etapa", titulo: `Etapa designada: ${nova.nome}`, texto: `${nova.projeto.codigo} · ${nova.projeto.nome}`, link: `/projetos/${projetoId}/etapas/${nova.id}` },
    gestor.id,
  );
  revalidar(projetoId);
  return { ok: "Etapa criada." };
}

export async function editarEtapa(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const gestor = await exigirGestor();
  const nome = texto(fd, "nome");
  if (!nome) return { erro: "Informe o nome da etapa." };
  const antes = await db.etapa.findUniqueOrThrow({ where: { id }, include: { responsavel: true } });
  const responsavelId = texto(fd, "responsavelId");
  const etapa = await db.etapa.update({
    where: { id },
    data: { nome, descricao: texto(fd, "descricao"), responsavelId, prazo: parseDataInput(fd.get("prazo")) },
    include: { responsavel: true },
  });
  if (antes.responsavelId !== responsavelId) {
    await comentarioSistema(id, gestor.id, `designou a etapa para ${etapa.responsavel?.nome ?? "ninguém"}`);
    await avisar([responsavelId], { tipo: "etapa", titulo: `Etapa designada: ${etapa.nome}`, link: `/projetos/${etapa.projetoId}/etapas/${id}` }, gestor.id);
  }
  revalidar(etapa.projetoId, id);
  return { ok: "Etapa atualizada." };
}

export async function moverEtapa(id: string, direcao: "cima" | "baixo") {
  await exigirGestor();
  const etapa = await db.etapa.findUniqueOrThrow({ where: { id } });
  const vizinha = await db.etapa.findFirst({
    where: { projetoId: etapa.projetoId, ordem: direcao === "cima" ? { lt: etapa.ordem } : { gt: etapa.ordem } },
    orderBy: { ordem: direcao === "cima" ? "desc" : "asc" },
  });
  if (!vizinha) return;
  await db.$transaction([
    db.etapa.update({ where: { id: etapa.id }, data: { ordem: vizinha.ordem } }),
    db.etapa.update({ where: { id: vizinha.id }, data: { ordem: etapa.ordem } }),
  ]);
  revalidar(etapa.projetoId);
}

export async function excluirEtapa(id: string) {
  await exigirGestor();
  const etapa = await db.etapa.delete({ where: { id } });
  revalidar(etapa.projetoId);
}

// Fluxo: Pendente → Em andamento → Aguardando aprovação → (gestor aprova) Concluída
export async function iniciarEtapa(id: string) {
  const u = await exigirUsuario();
  const etapa = await etapaComAcesso(id, u);
  if (etapa.status !== "PENDENTE") return;
  await db.etapa.update({ where: { id }, data: { status: "EM_ANDAMENTO", iniciadaEm: new Date() } });
  await comentarioSistema(id, u.id, "iniciou a etapa");
  revalidar(etapa.projetoId, id);
}

export async function enviarParaAprovacao(id: string) {
  const u = await exigirUsuario();
  const etapa = await etapaComAcesso(id, u);
  if (etapa.status === "CONCLUIDA" || etapa.status === "AGUARDANDO_APROVACAO") return;
  await db.etapa.update({
    where: { id },
    data: { status: "AGUARDANDO_APROVACAO", enviadaEm: new Date(), iniciadaEm: etapa.iniciadaEm ?? new Date() },
  });
  await comentarioSistema(id, u.id, "enviou a etapa para aprovação do gestor");
  await avisar(await idsGestores(), {
    tipo: "aprovacao",
    titulo: `Aprovação pendente: ${etapa.nome}`,
    texto: `${u.nome} enviou a etapa para aprovação`,
    link: `/projetos/${etapa.projetoId}/etapas/${id}`,
  }, u.id);
  revalidar(etapa.projetoId, id);
}

export async function aprovarEtapa(id: string) {
  const g = await exigirGestor();
  const etapa = await db.etapa.update({
    where: { id },
    data: { status: "CONCLUIDA", concluidaEm: new Date(), aprovadaPorId: g.id },
  });
  await comentarioSistema(id, g.id, "aprovou e concluiu a etapa");
  await avisar([etapa.responsavelId], { tipo: "aprovacao", titulo: `Etapa aprovada: ${etapa.nome} ✅`, link: `/projetos/${etapa.projetoId}/etapas/${id}` }, g.id);
  revalidar(etapa.projetoId, id);
}

export async function devolverEtapa(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const g = await exigirGestor();
  const motivo = texto(fd, "motivo");
  if (!motivo) return { erro: "Explique o que precisa ser ajustado." };
  const etapa = await db.etapa.update({
    where: { id },
    data: { status: "EM_ANDAMENTO", concluidaEm: null, aprovadaPorId: null },
  });
  await comentarioSistema(id, g.id, "devolveu a etapa para ajustes");
  await db.comentario.create({ data: { etapaId: id, autorId: g.id, texto: motivo } });
  await avisar([etapa.responsavelId], { tipo: "devolucao", titulo: `Etapa devolvida para ajustes: ${etapa.nome}`, texto: motivo, link: `/projetos/${etapa.projetoId}/etapas/${id}` }, g.id);
  revalidar(etapa.projetoId, id);
  return { ok: "Etapa devolvida ao responsável." };
}

export async function definirStatusEtapa(id: string, fd: FormData) {
  const g = await exigirGestor();
  const status = String(fd.get("status")) as StatusEtapa;
  if (!["PENDENTE", "EM_ANDAMENTO", "AGUARDANDO_APROVACAO", "CONCLUIDA"].includes(status)) return;
  const concluida = status === "CONCLUIDA";
  const etapa = await db.etapa.update({
    where: { id },
    data: {
      status,
      concluidaEm: concluida ? new Date() : null,
      aprovadaPorId: concluida ? g.id : null,
      iniciadaEm: status === "PENDENTE" ? null : undefined,
    },
  });
  await comentarioSistema(id, g.id, `alterou o status para "${status.replace(/_/g, " ").toLowerCase()}"`);
  revalidar(etapa.projetoId, id);
}

export async function comentar(etapaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const u = await exigirUsuario();
  const msg = texto(fd, "texto");
  if (!msg) return { erro: "Escreva um comentário." };
  try {
    const etapa = await etapaComAcesso(etapaId, u);
    await db.comentario.create({ data: { etapaId, autorId: u.id, texto: msg.slice(0, 4000) } });
    // Gestor comenta -> avisa o responsável; responsável comenta -> avisa os gestores.
    await avisar(u.perfil === "GESTOR" ? [etapa.responsavelId] : await idsGestores(), {
      tipo: "comentario",
      titulo: `${u.nome.split(" ")[0]} comentou em ${etapa.nome}`,
      texto: msg,
      link: `/projetos/${etapa.projetoId}/etapas/${etapaId}`,
    }, u.id);
    revalidar(etapa.projetoId, etapaId);
    return { ok: "Comentário registrado." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível comentar." };
  }
}
