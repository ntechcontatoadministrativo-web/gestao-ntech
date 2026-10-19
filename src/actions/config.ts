"use server";

import { revalidatePath } from "next/cache";
import type { TipoProjeto } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirGestor } from "@/lib/auth";
import * as google from "@/lib/storage/google";
import type { EstadoForm } from "@/components/client";

export async function salvarModelo(id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  await exigirGestor();
  const nome = String(fd.get("nome") ?? "").trim();
  const dias = Math.max(1, Math.min(365, Number(fd.get("diasPadrao") ?? 7) || 7));
  const descricao = String(fd.get("descricao") ?? "").trim() || null;
  const t = String(fd.get("tipo") ?? "") as TipoProjeto;
  const tipo = ["SOFTWARE", "SITE", "SUPORTE", "PRODUTO", "INTERNO"].includes(t) ? t : null;
  if (!nome) return { erro: "Informe o nome da etapa." };

  if (id) {
    await db.modeloEtapa.update({ where: { id }, data: { nome, diasPadrao: dias, descricao, tipo } });
  } else {
    const ultima = await db.modeloEtapa.findFirst({ orderBy: { ordem: "desc" } });
    await db.modeloEtapa.create({ data: { nome, diasPadrao: dias, descricao, tipo, ordem: (ultima?.ordem ?? 0) + 1 } });
  }
  revalidatePath("/configuracoes");
  return { ok: "Modelo salvo." };
}

export async function alternarModelo(id: string) {
  await exigirGestor();
  const m = await db.modeloEtapa.findUniqueOrThrow({ where: { id } });
  await db.modeloEtapa.update({ where: { id }, data: { ativo: !m.ativo } });
  revalidatePath("/configuracoes");
}

export async function moverModelo(id: string, direcao: "cima" | "baixo") {
  await exigirGestor();
  const m = await db.modeloEtapa.findUniqueOrThrow({ where: { id } });
  const viz = await db.modeloEtapa.findFirst({
    where: { ordem: direcao === "cima" ? { lt: m.ordem } : { gt: m.ordem } },
    orderBy: { ordem: direcao === "cima" ? "desc" : "asc" },
  });
  if (!viz) return;
  await db.$transaction([
    db.modeloEtapa.update({ where: { id: m.id }, data: { ordem: viz.ordem } }),
    db.modeloEtapa.update({ where: { id: viz.id }, data: { ordem: m.ordem } }),
  ]);
  revalidatePath("/configuracoes");
}

export async function excluirModelo(id: string) {
  await exigirGestor();
  await db.modeloEtapa.delete({ where: { id } });
  revalidatePath("/configuracoes");
}

export async function desconectarDrive() {
  await exigirGestor();
  await google.desconectarDrive();
  revalidatePath("/configuracoes");
}

export async function definirPastaRaiz(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  await exigirGestor();
  const id = google.extrairIdDrive(String(fd.get("pasta") ?? ""));
  if (!id) return { erro: "Cole o link ou o ID de uma pasta do Drive." };
  try {
    await google.definirPastaRaiz(id);
    revalidatePath("/configuracoes");
    return { ok: "Pasta principal definida. Novos projetos serão criados dentro dela." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível acessar essa pasta." };
  }
}
