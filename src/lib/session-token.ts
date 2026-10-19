// Usado tanto no middleware (edge) quanto no servidor: só depende de `jose`.
import { SignJWT, jwtVerify } from "jose";

export const COOKIE_SESSAO = "ntech_sessao";
export const DURACAO_SESSAO_S = 60 * 60 * 12; // 12 horas

export type PayloadSessao = { uid: string; v: number };

// Sem SESSION_SECRET, usa a própria DATABASE_URL (também secreta) como chave HMAC.
// Efeito colateral: trocar a senha do banco encerra as sessões abertas.
export function segredo() {
  const s = process.env.SESSION_SECRET || (process.env.DATABASE_URL ? `ntech-sessao|${process.env.DATABASE_URL}` : "");
  if (s.length < 32) throw new Error("SESSION_SECRET ausente ou curto (mínimo 32 caracteres).");
  return new TextEncoder().encode(s);
}

export async function assinarSessao(payload: PayloadSessao) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_S}s`)
    .sign(segredo());
}

export async function verificarSessao(token: string): Promise<PayloadSessao | null> {
  try {
    const { payload } = await jwtVerify(token, segredo());
    if (typeof payload.uid !== "string" || typeof payload.v !== "number") return null;
    return { uid: payload.uid, v: payload.v };
  } catch {
    return null;
  }
}
