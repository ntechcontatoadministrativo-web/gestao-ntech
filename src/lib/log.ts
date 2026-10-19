import "server-only";
import type { AcaoLog } from "@prisma/client";
import { db } from "./db";
import { infoRequisicao } from "./auth";

export async function registrarLog(dados: {
  acao: AcaoLog;
  usuarioId?: string | null;
  arquivoId?: string | null;
  versaoId?: string | null;
  detalhe?: string | null;
}) {
  const { ip, userAgent } = infoRequisicao();
  await db.logAcesso.create({ data: { ...dados, ip, userAgent } });
}
