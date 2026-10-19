import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { segredo } from "./session-token";

// Tokens curtos e assinados para operações em duas etapas (upload, visualização).

export async function emitirTicket<T extends Record<string, unknown>>(tipo: string, dados: T, validade: string) {
  return new SignJWT({ ...dados, tipo }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(validade).sign(segredo());
}

export async function lerTicket<T>(tipo: string, token: string | null): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo());
    return payload.tipo === tipo ? (payload as T) : null;
  } catch {
    return null;
  }
}

export type TicketUpload = {
  uid: string;
  projetoId: string;
  etapaId: string | null;
  arquivoId: string | null;
  nome: string;
  mime: string;
  tamanho: number;
  modo: "drive" | "local";
  pastaId: string | null;
  observacao: string | null;
  acessoEquipe: "VISUALIZAR" | "BAIXAR" | null;
};

export type TicketVer = { uid: string; versaoId: string };
