import "server-only";
import { createReadStream, createWriteStream, promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { randomUUID } from "crypto";

// Armazenamento local — usado enquanto o Google Drive não está conectado
// (desenvolvimento e demonstração). Em produção use o Drive.
const RAIZ = path.join(process.cwd(), "storage");

function caminho(id: string) {
  if (!/^[\w-]+$/.test(id)) throw new Error("ID de arquivo inválido");
  return path.join(RAIZ, id);
}

export async function salvarStream(corpo: ReadableStream<Uint8Array>): Promise<{ id: string; tamanho: number }> {
  await fs.mkdir(RAIZ, { recursive: true });
  const id = randomUUID();
  await pipeline(Readable.fromWeb(corpo as never), createWriteStream(caminho(id)));
  const { size } = await fs.stat(caminho(id));
  return { id, tamanho: size };
}

export async function tamanho(id: string) {
  return (await fs.stat(caminho(id))).size;
}

export function abrir(id: string, inicio?: number, fim?: number): ReadableStream {
  return Readable.toWeb(createReadStream(caminho(id), { start: inicio, end: fim })) as ReadableStream;
}

export async function remover(id: string) {
  await fs.rm(caminho(id), { force: true });
}
