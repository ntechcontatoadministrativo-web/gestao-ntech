"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { NivelAcesso } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirGestor } from "@/lib/auth";
import { registrarLog } from "@/lib/log";
import { removerConteudo } from "@/lib/storage";
import { avisar } from "@/lib/avisos";

const NIVEIS: NivelAcesso[] = ["VISUALIZAR", "BAIXAR", "BLOQUEADO"];

function revalidar(arquivoId: string, projetoId: string) {
  revalidatePath(`/arquivos/${arquivoId}`);
  revalidatePath(`/projetos/${projetoId}`);
  revalidatePath("/arquivos");
}

// nivel = "PADRAO" remove a liberação individual (volta a valer a regra da equipe).
export async function definirAcesso(arquivoId: string, usuarioId: string, fd: FormData) {
  const gestor = await exigirGestor();
  const nivel = String(fd.get("nivel"));
  const arquivo = await db.arquivo.findUniqueOrThrow({ where: { id: arquivoId } });
  const alvo = await db.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { nome: true } });

  if (nivel === "PADRAO") {
    await db.acessoArquivo.deleteMany({ where: { arquivoId, usuarioId } });
    await registrarLog({ acao: "REMOVEU_ACESSO", usuarioId: gestor.id, arquivoId, detalhe: `Liberação individual removida: ${alvo.nome}` });
  } else if (NIVEIS.includes(nivel as NivelAcesso)) {
    const n = nivel as NivelAcesso;
    await db.acessoArquivo.upsert({
      where: { arquivoId_usuarioId: { arquivoId, usuarioId } },
      update: { nivel: n, concedidoPorId: gestor.id },
      create: { arquivoId, usuarioId, nivel: n, concedidoPorId: gestor.id },
    });
    await registrarLog({
      acao: n === "BLOQUEADO" ? "BLOQUEOU" : "LIBEROU",
      usuarioId: gestor.id,
      arquivoId,
      detalhe: `${alvo.nome}: ${n === "BLOQUEADO" ? "bloqueado" : n === "BAIXAR" ? "visualizar e baixar" : "só visualizar"}`,
    });
    if (n !== "BLOQUEADO") {
      await avisar([usuarioId], { tipo: "arquivo", titulo: `Arquivo liberado: ${arquivo.nome}`, texto: n === "BAIXAR" ? "Pode visualizar e baixar" : "Só visualização", link: `/arquivos/${arquivoId}` }, gestor.id);
    }
  }
  revalidar(arquivoId, arquivo.projetoId);
}

export async function definirAcessoEquipe(arquivoId: string, fd: FormData) {
  const gestor = await exigirGestor();
  const v = String(fd.get("nivel"));
  const nivel = NIVEIS.includes(v as NivelAcesso) ? (v as NivelAcesso) : null;
  const arquivo = await db.arquivo.update({ where: { id: arquivoId }, data: { acessoEquipe: nivel } });
  await registrarLog({
    acao: nivel && nivel !== "BLOQUEADO" ? "LIBEROU" : "BLOQUEOU",
    usuarioId: gestor.id,
    arquivoId,
    detalhe: `Equipe da ${arquivo.etapaId ? "etapa" : "projeto"}: ${nivel === "BAIXAR" ? "visualizar e baixar" : nivel === "VISUALIZAR" ? "só visualizar" : "sem acesso"}`,
  });
  revalidar(arquivoId, arquivo.projetoId);
}

// Bloqueio geral imediato: ninguém além dos gestores acessa mais o arquivo.
export async function bloquearTodos(arquivoId: string) {
  const gestor = await exigirGestor();
  const arquivo = await db.arquivo.update({ where: { id: arquivoId }, data: { acessoEquipe: "BLOQUEADO" } });
  await db.acessoArquivo.updateMany({ where: { arquivoId }, data: { nivel: "BLOQUEADO", concedidoPorId: gestor.id } });
  await registrarLog({ acao: "BLOQUEOU", usuarioId: gestor.id, arquivoId, detalhe: "Bloqueio geral do arquivo" });
  revalidar(arquivoId, arquivo.projetoId);
}

export async function excluirArquivo(arquivoId: string) {
  const gestor = await exigirGestor();
  const arquivo = await db.arquivo.findUniqueOrThrow({ where: { id: arquivoId }, include: { versoes: true } });
  for (const v of arquivo.versoes) await removerConteudo(v);
  await registrarLog({ acao: "EXCLUIU", usuarioId: gestor.id, arquivoId, detalhe: `Arquivo excluído: ${arquivo.nome}` });
  await db.arquivo.delete({ where: { id: arquivoId } });
  revalidatePath(`/projetos/${arquivo.projetoId}`);
  revalidatePath("/arquivos");
  redirect(`/projetos/${arquivo.projetoId}`);
}
