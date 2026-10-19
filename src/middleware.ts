import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, verificarSessao } from "./lib/session-token";

// Barreira rápida: só deixa passar quem tem token válido. A checagem completa
// (usuário ativo, versão da sessão, perfil) acontece no servidor a cada página/rota.
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_SESSAO)?.value;
  const ok = token ? await verificarSessao(token) : null;
  if (ok) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/google/callback|_next|favicon|icon|manifest|robots.txt|logo).*)"],
};
