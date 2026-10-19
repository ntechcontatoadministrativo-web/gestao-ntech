"use server";

import { revalidatePath } from "next/cache";
import type { StatusDeploy, StatusSprint } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirGestor, exigirUsuario } from "@/lib/auth";
import { criptografar, descriptografar } from "@/lib/crypto";
import { registrarLog } from "@/lib/log";
import { avisar, idsGestores } from "@/lib/avisos";
import { parseDataInput } from "@/lib/utils";
import type { EstadoForm } from "@/components/client";

const texto = (fd: FormData, k: string, max = 500) => {
  const v = String(fd.get(k) ?? "").trim();
  return v ? v.slice(0, max) : null;
};
const url = (fd: FormData, k: string) => {
  const v = texto(fd, k, 500);
  return v && /^https?:\/\//i.test(v) ? v : v ? `https://${v}` : null;
};

// ---------------------------------------------------------------------
// Sprints
// ---------------------------------------------------------------------

export async function salvarSprint(projetoId: string, id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  await exigirGestor();
  const nome = texto(fd, "nome", 80);
  const inicio = parseDataInput(fd.get("inicio"));
  const fim = parseDataInput(fd.get("fim"));
  if (!nome || !inicio || !fim) return { erro: "Nome, início e fim são obrigatórios." };
  if (fim <= inicio) return { erro: "O fim precisa ser depois do início." };
  const dados = { nome, objetivo: texto(fd, "objetivo", 500), inicio, fim };
  if (id) await db.sprint.update({ where: { id }, data: dados });
  else await db.sprint.create({ data: { ...dados, projetoId } });
  revalidatePath(`/projetos/${projetoId}`);
  revalidatePath("/quadro");
  return { ok: "Sprint salva." };
}

// Iniciar: só uma sprint ativa por projeto. Concluir: o que não foi feito volta para o backlog (sem sprint).
export async function alterarStatusSprint(id: string, status: StatusSprint) {
  await exigirGestor();
  const s = await db.sprint.findUniqueOrThrow({ where: { id } });
  if (status === "ATIVA") {
    await db.$transaction([
      db.sprint.updateMany({ where: { projetoId: s.projetoId, status: "ATIVA", NOT: { id } }, data: { status: "PLANEJADA" } }),
      db.sprint.update({ where: { id }, data: { status: "ATIVA", concluidaEm: null } }),
    ]);
  } else if (status === "CONCLUIDA") {
    await db.$transaction([
      db.tarefa.updateMany({ where: { sprintId: id, status: { notIn: ["FEITA", "CANCELADA"] } }, data: { sprintId: null } }),
      db.sprint.update({ where: { id }, data: { status: "CONCLUIDA", concluidaEm: new Date() } }),
    ]);
  } else {
    await db.sprint.update({ where: { id }, data: { status } });
  }
  revalidatePath(`/projetos/${s.projetoId}`);
  revalidatePath("/quadro");
}

export async function excluirSprint(id: string) {
  await exigirGestor();
  const s = await db.sprint.delete({ where: { id } });
  revalidatePath(`/projetos/${s.projetoId}`);
}

// ---------------------------------------------------------------------
// Ambientes e deploys
// ---------------------------------------------------------------------

export async function salvarAmbiente(projetoId: string, id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  await exigirGestor();
  const nome = texto(fd, "nome", 60);
  if (!nome) return { erro: "Informe o nome do ambiente (ex.: Produção)." };
  const dados = { nome, url: url(fd, "url"), branch: texto(fd, "branch", 120), hospedagem: texto(fd, "hospedagem", 120), observacoes: texto(fd, "observacoes", 2000) };
  if (id) await db.ambiente.update({ where: { id }, data: dados });
  else await db.ambiente.create({ data: { ...dados, projetoId } });
  revalidatePath(`/projetos/${projetoId}`);
  return { ok: "Ambiente salvo." };
}

export async function excluirAmbiente(id: string) {
  await exigirGestor();
  const a = await db.ambiente.delete({ where: { id } });
  revalidatePath(`/projetos/${a.projetoId}`);
}

const STATUS_DEPLOY: StatusDeploy[] = ["SUCESSO", "FALHOU", "REVERTIDO"];

// Qualquer pessoa da equipe registra um deploy; o gestor recebe aviso de produção e de falhas.
export async function registrarDeploy(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const u = await exigirUsuario();
  const projetoId = texto(fd, "projetoId");
  const versao = texto(fd, "versao", 80);
  if (!projetoId || !versao) return { erro: "Escolha o projeto e informe a versão/tag." };
  const ambienteId = texto(fd, "ambienteId");
  const ambiente = ambienteId ? await db.ambiente.findFirst({ where: { id: ambienteId, projetoId } }) : null;
  const st = String(fd.get("status")) as StatusDeploy;
  const d = await db.deploy.create({
    data: {
      projetoId,
      ambienteId: ambiente?.id ?? null,
      versao,
      notas: texto(fd, "notas", 8000),
      status: STATUS_DEPLOY.includes(st) ? st : "SUCESSO",
      autorId: u.id,
    },
    include: { projeto: { select: { codigo: true } } },
  });
  if (d.status !== "SUCESSO" || /produ/i.test(ambiente?.nome ?? "")) {
    await avisar(
      await idsGestores(),
      {
        tipo: "deploy",
        titulo: `${d.status === "SUCESSO" ? "🚀" : "⚠️"} ${d.projeto.codigo} ${versao} ${ambiente ? `em ${ambiente.nome}` : ""}${d.status !== "SUCESSO" ? ` (${d.status.toLowerCase()})` : ""}`,
        texto: `por ${u.nome.split(" ")[0]}`,
        link: `/deploys`,
      },
      u.id,
    );
  }
  revalidatePath("/deploys");
  revalidatePath(`/projetos/${projetoId}`);
  return { ok: `Deploy ${versao} registrado.` };
}

export async function excluirDeploy(id: string) {
  await exigirGestor();
  const d = await db.deploy.delete({ where: { id } });
  revalidatePath("/deploys");
  revalidatePath(`/projetos/${d.projetoId}`);
}

// ---------------------------------------------------------------------
// Cofre de credenciais (somente gestor)
// ---------------------------------------------------------------------

export async function salvarCredencial(id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const u = await exigirGestor();
  const nome = texto(fd, "nome", 120);
  const segredo = String(fd.get("segredo") ?? "");
  if (!nome) return { erro: "Dê um nome à credencial." };
  if (!id && !segredo) return { erro: "Informe a senha / chave." };
  const dados = {
    nome,
    projetoId: texto(fd, "projetoId"),
    url: url(fd, "url"),
    usuario: texto(fd, "usuario", 200),
    observacoes: texto(fd, "observacoes", 2000),
    // Em branco na edição = mantém o segredo atual.
    ...(segredo ? { segredoCifrado: criptografar(segredo.slice(0, 10000)) } : {}),
  };
  if (id) await db.credencial.update({ where: { id }, data: dados });
  else await db.credencial.create({ data: { ...dados, segredoCifrado: dados.segredoCifrado!, criadoPorId: u.id } });
  revalidatePath("/cofre");
  return { ok: "Credencial salva." };
}

export async function revelarCredencial(id: string): Promise<string> {
  const u = await exigirGestor();
  const c = await db.credencial.findUniqueOrThrow({ where: { id } });
  await registrarLog({ acao: "VIU_CREDENCIAL", usuarioId: u.id, detalhe: c.nome });
  return descriptografar(c.segredoCifrado);
}

export async function excluirCredencial(id: string) {
  await exigirGestor();
  await db.credencial.delete({ where: { id } });
  revalidatePath("/cofre");
}
