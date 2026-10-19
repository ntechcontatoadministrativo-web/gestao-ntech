import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Usuario } from "@prisma/client";
import { db } from "./db";
import { COOKIE_SESSAO, DURACAO_SESSAO_S, assinarSessao, verificarSessao } from "./session-token";

export type UsuarioSessao = Pick<Usuario, "id" | "nome" | "email" | "perfil" | "cargo">;

// Confere a sessão no banco a cada requisição: usuário desativado ou com a
// versão de sessão trocada perde o acesso imediatamente.
export async function usuarioAtual(): Promise<UsuarioSessao | null> {
  const token = cookies().get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  const payload = await verificarSessao(token);
  if (!payload) return null;

  const usuario = await db.usuario.findUnique({
    where: { id: payload.uid },
    select: { id: true, nome: true, email: true, perfil: true, cargo: true, ativo: true, versaoSessao: true },
  });
  if (!usuario || !usuario.ativo || usuario.versaoSessao !== payload.v) return null;

  const { ativo: _a, versaoSessao: _v, ...resto } = usuario;
  return resto;
}

export async function exigirUsuario(): Promise<UsuarioSessao> {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  return u;
}

export async function exigirGestor(): Promise<UsuarioSessao> {
  const u = await exigirUsuario();
  if (u.perfil !== "GESTOR") redirect("/painel");
  return u;
}

export async function iniciarSessao(usuario: { id: string; versaoSessao: number }) {
  const token = await assinarSessao({ uid: usuario.id, v: usuario.versaoSessao });
  cookies().set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_SESSAO_S,
  });
}

export function encerrarSessao() {
  cookies().delete(COOKIE_SESSAO);
}

export function infoRequisicao() {
  const h = headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

// URL pública para links em mensagens (APP_URL/Render; senão, o host da requisição).
export function urlBase() {
  const fixa = (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
  if (fixa) return fixa;
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
