"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { StatusContrato, TipoContrato } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirGestor } from "@/lib/auth";
import { parseDataInput, parseMoeda } from "@/lib/utils";
import type { EstadoForm } from "@/components/client";

const texto = (fd: FormData, k: string, max = 500) => {
  const v = String(fd.get(k) ?? "").trim();
  return v ? v.slice(0, max) : null;
};
const inteiro = (fd: FormData, k: string, min: number, max: number) => {
  const n = Math.round(Number(fd.get(k)));
  return Number.isFinite(n) && n >= min && n <= max && String(fd.get(k) ?? "").trim() !== "" ? n : null;
};

function dadosCliente(fd: FormData) {
  return {
    nome: texto(fd, "nome", 120),
    razaoSocial: texto(fd, "razaoSocial", 200),
    documento: texto(fd, "documento", 30),
    contatoNome: texto(fd, "contatoNome", 120),
    email: texto(fd, "email", 200)?.toLowerCase() ?? null,
    telefone: texto(fd, "telefone", 30),
    site: texto(fd, "site", 300),
    observacoes: texto(fd, "observacoes", 4000),
  };
}

export async function criarCliente(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  await exigirGestor();
  const d = dadosCliente(fd);
  if (!d.nome) return { erro: "Informe o nome do cliente." };
  const c = await db.cliente.create({ data: { ...d, nome: d.nome } });
  revalidatePath("/clientes");
  redirect(`/clientes/${c.id}`);
}

export async function editarCliente(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  await exigirGestor();
  const d = dadosCliente(fd);
  if (!d.nome) return { erro: "Informe o nome do cliente." };
  await db.cliente.update({ where: { id }, data: { ...d, nome: d.nome, ativo: fd.get("ativo") === "on" } });
  // Mantém o nome copiado nos projetos.
  await db.projeto.updateMany({ where: { clienteId: id }, data: { cliente: d.nome } });
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  return { ok: "Cliente atualizado." };
}

export async function excluirCliente(id: string) {
  await exigirGestor();
  await db.cliente.delete({ where: { id } });
  revalidatePath("/clientes");
  redirect("/clientes");
}

const TIPOS: TipoContrato[] = ["PROJETO", "MENSALIDADE", "SUPORTE", "HORAS"];
const STATUS: StatusContrato[] = ["PROPOSTA", "ATIVO", "ENCERRADO", "CANCELADO"];

function dadosContrato(fd: FormData) {
  const tipo = String(fd.get("tipo")) as TipoContrato;
  const status = String(fd.get("status")) as StatusContrato;
  return {
    titulo: texto(fd, "titulo", 200),
    tipo: TIPOS.includes(tipo) ? tipo : "PROJETO",
    status: STATUS.includes(status) ? status : "ATIVO",
    valorCentavos: parseMoeda(fd.get("valor")),
    diaVencimento: inteiro(fd, "diaVencimento", 1, 31),
    horasMes: inteiro(fd, "horasMes", 1, 2000),
    slaRespostaHoras: inteiro(fd, "slaRespostaHoras", 1, 720),
    slaSolucaoHoras: inteiro(fd, "slaSolucaoHoras", 1, 2160),
    inicio: parseDataInput(fd.get("inicio")) ?? new Date(),
    fim: parseDataInput(fd.get("fim")),
    projetoId: texto(fd, "projetoId"),
    observacoes: texto(fd, "observacoes", 4000),
  };
}

export async function salvarContrato(clienteId: string, id: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  await exigirGestor();
  const d = dadosContrato(fd);
  if (!d.titulo) return { erro: "Dê um título ao contrato." };
  if (id) await db.contrato.update({ where: { id }, data: { ...d, titulo: d.titulo } });
  else await db.contrato.create({ data: { ...d, titulo: d.titulo, clienteId } });
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/clientes");
  revalidatePath("/painel");
  return { ok: "Contrato salvo." };
}

export async function excluirContrato(id: string) {
  await exigirGestor();
  const c = await db.contrato.delete({ where: { id } });
  revalidatePath(`/clientes/${c.clienteId}`);
  revalidatePath("/clientes");
}
