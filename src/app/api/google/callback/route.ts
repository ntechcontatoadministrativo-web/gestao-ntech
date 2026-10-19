import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { usuarioAtual } from "@/lib/auth";
import { pastaRaiz, trocarCodigo } from "@/lib/storage/google";
import { appUrl } from "@/lib/utils";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = appUrl() || req.url;
  const voltar = (q: string) => NextResponse.redirect(new URL(`/configuracoes?google=${q}`, base));

  const u = await usuarioAtual();
  if (!u || u.perfil !== "GESTOR") return NextResponse.redirect(new URL("/login", base));

  const state = cookies().get("g_state")?.value;
  cookies().delete("g_state");
  if (!state || state !== url.searchParams.get("state")) return voltar("estado-invalido");
  if (url.searchParams.get("error")) return voltar("cancelado");

  const code = url.searchParams.get("code");
  if (!code) return voltar("erro");
  try {
    await trocarCodigo(code);
    await pastaRaiz();
    return voltar("conectado");
  } catch (e) {
    console.error("[google] callback", e);
    return voltar("erro");
  }
}
