"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { exigirGestor } from "@/lib/auth";
import { parseDataInput } from "@/lib/utils";
import type { ResultadoLevantamento } from "@/lib/ia/levantamento";
import type { EstadoForm } from "@/components/client";

const PONTOS = [1, 2, 3, 5, 8, 13, 21];
const pontoMaisProximo = (n: number) => PONTOS.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));

// Cria o projeto com as etapas, prazos e backlog propostos pela IA (ajustados pelo gestor no formulário).
export async function criarProjetoDoLevantamento(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const gestor = await exigirGestor();
  const lev = await db.levantamento.findUniqueOrThrow({ where: { id } });
  if (lev.status !== "CONCLUIDO" || !lev.resultado) return { erro: "O escopo ainda não terminou." };
  if (lev.projetoId) redirect(`/projetos/${lev.projetoId}`);
  const r = lev.resultado as unknown as ResultadoLevantamento;

  const nome = String(fd.get("nome") ?? "").trim() || lev.titulo;
  const ano = new Date().getFullYear();
  let codigo = String(fd.get("codigo") ?? "").trim().toUpperCase();
  if (!codigo) {
    const n = await db.projeto.count({ where: { codigo: { startsWith: `P${ano}-` } } });
    for (let i = n + 1; ; i++) {
      codigo = `P${ano}-${String(i).padStart(3, "0")}`;
      if (!(await db.projeto.findUnique({ where: { codigo } }))) break;
    }
  } else if (await db.projeto.findUnique({ where: { codigo } })) {
    return { erro: `Já existe um projeto com o código ${codigo}.` };
  }

  const inicio = parseDataInput(fd.get("dataInicio")) ?? new Date();
  let cursor = inicio.getTime();
  const etapas = r.etapas
    .map((e, i) => ({ e, i, incluir: fd.get(`incluir_${i}`) === "on" }))
    .filter((x) => x.incluir)
    .map(({ e, i }, ordem) => {
      const dias = Math.max(1, Math.round(Number(fd.get(`dias_${i}`)) || e.dias));
      cursor += dias * 86400000;
      const entregas = e.entregaveis.length ? `\n\nEntregáveis:\n${e.entregaveis.map((x) => `• ${x}`).join("\n")}` : "";
      return {
        nomeIA: e.nome,
        nome: String(fd.get(`nome_${i}`) ?? e.nome).trim() || e.nome,
        descricao: `${e.descricao}${entregas}`.slice(0, 4000),
        ordem: ordem + 1,
        prazo: new Date(cursor),
        responsavelId: String(fd.get(`resp_${i}`) ?? "") || null,
      };
    });
  if (!etapas.length) return { erro: "Selecione ao menos uma etapa." };

  const escopo = [
    r.resumo,
    "",
    "Escopo:",
    ...r.escopo.map((s) => `• ${s.item}: ${s.descricao}`),
    ...(r.foraDoEscopo.length ? ["", "Fora do escopo:", ...r.foraDoEscopo.map((x) => `• ${x}`)] : []),
    "",
    "Premissas:",
    ...r.premissas.map((p) => `• ${p}`),
  ].join("\n");

  const clienteId = String(fd.get("clienteId") ?? "") || null;
  const cliente = clienteId ? await db.cliente.findUnique({ where: { id: clienteId }, select: { id: true, nome: true } }) : null;

  const projeto = await db.projeto.create({
    data: {
      codigo,
      nome,
      tipo: r.tipo,
      clienteId: cliente?.id ?? null,
      cliente: cliente?.nome ?? lev.cliente,
      stack: r.stackSugerida.map((s) => s.tecnologia).join(", ").slice(0, 300) || null,
      descricao: escopo.slice(0, 8000),
      dataInicio: inicio,
      prazoFinal: new Date(cursor),
      criadoPorId: gestor.id,
      etapas: { create: etapas.map(({ nomeIA: _n, ...e }) => e) },
    },
    include: { etapas: { select: { id: true, nome: true } } },
  });

  // Backlog: itens marcados entram sem responsável, ligados à etapa sugerida.
  const etapaPorNomeIA = new Map(etapas.map((e) => [e.nomeIA.trim().toLowerCase(), projeto.etapas.find((p) => p.nome === e.nome)?.id ?? null]));
  const itens = r.backlog
    .map((b, i) => ({ b, incluir: fd.get(`item_${i}`) === "on" }))
    .filter((x) => x.incluir)
    .map(({ b }) => ({
      titulo: b.titulo.slice(0, 200),
      descricao: b.descricao.slice(0, 8000),
      tipo: b.tipo,
      prioridade: b.prioridade,
      pontos: pontoMaisProximo(Math.max(1, b.pontos)),
      status: "BACKLOG" as const,
      projetoId: projeto.id,
      etapaId: etapaPorNomeIA.get(b.etapa.trim().toLowerCase()) ?? null,
      criadoPorId: gestor.id,
    }));
  if (itens.length) await db.tarefa.createMany({ data: itens });

  await db.levantamento.update({ where: { id }, data: { projetoId: projeto.id } });
  revalidatePath("/projetos");
  revalidatePath("/ia");
  redirect(`/projetos/${projeto.id}`);
}

export async function excluirLevantamento(id: string) {
  await exigirGestor();
  await db.levantamento.delete({ where: { id } });
  revalidatePath("/ia");
  redirect("/ia");
}
