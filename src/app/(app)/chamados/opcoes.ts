import "server-only";
import { db } from "@/lib/db";
import type { OpcoesChamado } from "./cliente";

export async function opcoesChamado(): Promise<OpcoesChamado> {
  const [pessoas, clientes, projetos] = await Promise.all([
    db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.cliente.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.projeto.findMany({ where: { status: { not: "CANCELADO" } }, select: { id: true, codigo: true, nome: true, clienteId: true }, orderBy: { codigo: "desc" } }),
  ]);
  return { pessoas, clientes, projetos };
}
