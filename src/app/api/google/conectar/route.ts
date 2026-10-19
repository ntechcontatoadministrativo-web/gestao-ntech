import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { usuarioAtual } from "@/lib/auth";
import { googleConfigurado, urlAutorizacao } from "@/lib/storage/google";

export async function GET(req: Request) {
  const u = await usuarioAtual();
  if (!u || u.perfil !== "GESTOR") return NextResponse.redirect(new URL("/painel", req.url));
  if (!googleConfigurado()) return NextResponse.redirect(new URL("/configuracoes?google=sem-credenciais", req.url));

  const state = randomBytes(16).toString("hex");
  cookies().set("g_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return NextResponse.redirect(urlAutorizacao(state));
}
