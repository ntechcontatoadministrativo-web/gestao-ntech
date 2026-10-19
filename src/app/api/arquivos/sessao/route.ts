import { NextResponse } from "next/server";
import { z } from "zod";
import { usuarioAtual } from "@/lib/auth";
import { db } from "@/lib/db";
import { emitirTicket, type TicketUpload } from "@/lib/tickets";
import { mimeDe, modoArmazenamento, pastaDestino } from "@/lib/storage";
import { iniciarUploadResumivel } from "@/lib/storage/google";
import { appUrl } from "@/lib/utils";

const Corpo = z.object({
  projetoId: z.string().optional(),
  etapaId: z.string().nullable().optional(),
  arquivoId: z.string().nullable().optional(),
  nome: z.string().min(1).max(250),
  tamanho: z.number().int().positive(),
  mime: z.string().max(200).optional(),
  observacao: z.string().max(500).nullable().optional(),
  acessoEquipe: z.enum(["VISUALIZAR", "BAIXAR"]).nullable().optional(),
});

const LIMITE_DRIVE = 5 * 1024 ** 4; // 5 TB (limite do Drive)
const LIMITE_LOCAL = 2 * 1024 ** 3; // 2 GB no modo local

// 1ª etapa do upload: confere a permissão e devolve para onde o navegador deve enviar o arquivo.
export async function POST(req: Request) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ erro: "Sessão expirada. Entre novamente." }, { status: 401 });

  const parse = Corpo.safeParse(await req.json().catch(() => null));
  if (!parse.success) return NextResponse.json({ erro: "Dados de upload inválidos." }, { status: 400 });
  const b = parse.data;

  let projetoId = b.projetoId ?? null;
  let etapaId = b.etapaId ?? null;
  if (b.arquivoId) {
    const arq = await db.arquivo.findUnique({ where: { id: b.arquivoId } });
    if (!arq) return NextResponse.json({ erro: "Arquivo não encontrado." }, { status: 404 });
    projetoId = arq.projetoId;
    etapaId = arq.etapaId;
  }
  if (!projetoId) return NextResponse.json({ erro: "Projeto não informado." }, { status: 400 });

  if (etapaId) {
    const etapa = await db.etapa.findUnique({ where: { id: etapaId } });
    if (!etapa || etapa.projetoId !== projetoId) return NextResponse.json({ erro: "Etapa inválida." }, { status: 400 });
    if (u.perfil !== "GESTOR" && etapa.responsavelId !== u.id) {
      return NextResponse.json({ erro: "Só o responsável pela etapa ou o gestor pode enviar arquivos aqui." }, { status: 403 });
    }
  } else if (u.perfil !== "GESTOR") {
    return NextResponse.json({ erro: "Colaboradores enviam arquivos dentro das suas etapas." }, { status: 403 });
  }

  const modo = await modoArmazenamento();
  if (b.tamanho > (modo === "drive" ? LIMITE_DRIVE : LIMITE_LOCAL)) {
    return NextResponse.json({ erro: "Arquivo grande demais." }, { status: 413 });
  }

  const mime = mimeDe(b.nome, b.mime);
  try {
    const pastaId = modo === "drive" ? await pastaDestino(projetoId, etapaId) : null;
    const ticket: TicketUpload = {
      uid: u.id,
      projetoId,
      etapaId,
      arquivoId: b.arquivoId ?? null,
      nome: b.nome,
      mime,
      tamanho: b.tamanho,
      modo,
      pastaId,
      observacao: b.observacao ?? null,
      acessoEquipe: u.perfil === "GESTOR" ? (b.acessoEquipe ?? null) : null,
    };
    const token = await emitirTicket("upload", ticket, "12h");

    if (modo === "drive") {
      const origin = req.headers.get("origin") ?? (appUrl() || undefined) ?? new URL(req.url).origin;
      const uploadUrl = await iniciarUploadResumivel({ nome: b.nome, mime, tamanho: b.tamanho, pastaId: pastaId!, origin });
      return NextResponse.json({ modo, uploadUrl, token });
    }
    return NextResponse.json({ modo, uploadUrl: `/api/arquivos/local?t=${encodeURIComponent(token)}`, token });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Falha ao preparar upload." }, { status: 502 });
  }
}
