import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const [avisos, naoLidos] = await Promise.all([
    db.aviso.findMany({ where: { usuarioId: u.id }, orderBy: { criadoEm: "desc" }, take: 40 }),
    db.aviso.count({ where: { usuarioId: u.id, lidoEm: null } }),
  ]);
  return NextResponse.json({ avisos, naoLidos });
}

// { id } marca um aviso como lido; sem id, marca todos.
export async function POST(req: Request) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;
  await db.aviso.updateMany({ where: { usuarioId: u.id, lidoEm: null, ...(id ? { id } : {}) }, data: { lidoEm: new Date() } });
  return NextResponse.json({ ok: true });
}
