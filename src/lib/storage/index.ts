import "server-only";
import type { ArquivoVersao, Etapa, Projeto } from "@prisma/client";
import { db } from "../db";
import * as google from "./google";
import * as local from "./local";

export type ModoArmazenamento = "drive" | "local";

export async function modoArmazenamento(): Promise<ModoArmazenamento> {
  return (await google.driveConectado()) ? "drive" : "local";
}

const limparNome = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 120);

export async function garantirPastaProjeto(projeto: Pick<Projeto, "id" | "codigo" | "nome" | "pastaDriveId">) {
  if (projeto.pastaDriveId) return projeto.pastaDriveId;
  const raiz = await google.pastaRaiz();
  const id = await google.criarPasta(limparNome(`${projeto.codigo} - ${projeto.nome}`), raiz);
  await db.projeto.update({ where: { id: projeto.id }, data: { pastaDriveId: id } });
  return id;
}

export async function garantirPastaEtapa(etapa: Pick<Etapa, "id" | "ordem" | "nome" | "pastaDriveId" | "projetoId">) {
  if (etapa.pastaDriveId) return etapa.pastaDriveId;
  const projeto = await db.projeto.findUniqueOrThrow({ where: { id: etapa.projetoId } });
  const pai = await garantirPastaProjeto(projeto);
  const id = await google.criarPasta(limparNome(`${String(etapa.ordem).padStart(2, "0")} - ${etapa.nome}`), pai);
  await db.etapa.update({ where: { id: etapa.id }, data: { pastaDriveId: id } });
  return id;
}

export async function pastaDestino(projetoId: string, etapaId: string | null) {
  if (etapaId) {
    const etapa = await db.etapa.findUniqueOrThrow({ where: { id: etapaId } });
    return garantirPastaEtapa(etapa);
  }
  const projeto = await db.projeto.findUniqueOrThrow({ where: { id: projetoId } });
  return garantirPastaProjeto(projeto);
}

// Lê o conteúdo de uma versão, com suporte a Range (necessário para PDFs grandes).
export async function abrirConteudo(
  versao: Pick<ArquivoVersao, "driveFileId" | "armazenamento" | "tamanho" | "mimeType">,
  range: string | null,
): Promise<{ corpo: ReadableStream; status: number; headers: Record<string, string> }> {
  if (versao.armazenamento === "drive") {
    const r = await google.baixar(versao.driveFileId, range);
    const headers: Record<string, string> = { "Accept-Ranges": "bytes" };
    for (const h of ["content-length", "content-range"]) {
      const v = r.headers.get(h);
      if (v) headers[h] = v;
    }
    return { corpo: r.body!, status: r.status, headers };
  }

  const total = await local.tamanho(versao.driveFileId);
  const m = range?.match(/bytes=(\d*)-(\d*)/);
  if (m && (m[1] || m[2])) {
    const inicio = m[1] ? Number(m[1]) : Math.max(0, total - Number(m[2]));
    const fim = m[1] && m[2] ? Math.min(Number(m[2]), total - 1) : total - 1;
    return {
      corpo: local.abrir(versao.driveFileId, inicio, fim),
      status: 206,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${inicio}-${fim}/${total}`,
        "Content-Length": String(fim - inicio + 1),
      },
    };
  }
  return {
    corpo: local.abrir(versao.driveFileId),
    status: 200,
    headers: { "Accept-Ranges": "bytes", "Content-Length": String(total) },
  };
}

export async function removerConteudo(versao: Pick<ArquivoVersao, "driveFileId" | "armazenamento">) {
  if (versao.armazenamento === "drive") await google.lixeira(versao.driveFileId).catch(() => {});
  else await local.remover(versao.driveFileId);
}

const MIMES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  dwg: "application/acad",
  rvt: "application/octet-stream",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function mimeDe(nome: string, informado?: string | null) {
  if (informado && informado !== "application/octet-stream") return informado;
  return MIMES[extensaoDe(nome) ?? ""] ?? "application/octet-stream";
}

export function extensaoDe(nome: string) {
  const i = nome.lastIndexOf(".");
  return i > 0 ? nome.slice(i + 1).toLowerCase() : null;
}

export const visualizavel = (mime: string) => mime === "application/pdf" || mime.startsWith("image/");
