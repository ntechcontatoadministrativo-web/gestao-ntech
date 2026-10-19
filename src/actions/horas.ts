"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/auth";
import { podeVerProjeto } from "@/lib/permissoes";
import { parseDataInput, parseHoras } from "@/lib/utils";
import type { EstadoForm } from "@/components/client";

const texto = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v || null;
};

export async function apontarHoras(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const u = await exigirUsuario();
  const minutos = parseHoras(fd.get("horas"));
  if (!minutos || minutos < 5 || minutos > 24 * 60) return { erro: "Informe as horas, ex.: 1:30, 2h ou 1,5." };

  let projetoId = texto(fd, "projetoId");
  const etapaId = texto(fd, "etapaId");
  const tarefaId = texto(fd, "tarefaId");
  if (tarefaId) {
    const t = await db.tarefa.findUnique({ where: { id: tarefaId } });
    if (!t) return { erro: "Tarefa não encontrada." };
    if (u.perfil !== "GESTOR" && t.responsavelId !== u.id) return { erro: "Esta tarefa não é sua." };
    projetoId ??= t.projetoId;
  }
  if (etapaId) {
    const e = await db.etapa.findUnique({ where: { id: etapaId } });
    if (!e) return { erro: "Etapa não encontrada." };
    projetoId = e.projetoId;
  }
  if (!projetoId) return { erro: "Escolha o projeto." };
  if (!(await podeVerProjeto(u, projetoId))) {
    const temTarefa = tarefaId && (await db.tarefa.count({ where: { id: tarefaId, responsavelId: u.id } }));
    if (!temTarefa) return { erro: "Você não participa deste projeto." };
  }

  const data = parseDataInput(fd.get("data")) ?? parseDataInput(new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10))!;
  if (data.getTime() > Date.now() + 86400000) return { erro: "Não dá para apontar horas no futuro." };

  await db.apontamento.create({
    data: { usuarioId: u.id, projetoId, etapaId, tarefaId, data, minutos, descricao: texto(fd, "descricao")?.slice(0, 1000) ?? null },
  });
  revalidatePath("/horas");
  revalidatePath(`/projetos/${projetoId}`);
  return { ok: "Horas apontadas." };
}

export async function excluirApontamento(id: string) {
  const u = await exigirUsuario();
  const a = await db.apontamento.findUniqueOrThrow({ where: { id } });
  if (u.perfil !== "GESTOR" && a.usuarioId !== u.id) throw new Error("Sem permissão.");
  await db.apontamento.delete({ where: { id } });
  revalidatePath("/horas");
}
