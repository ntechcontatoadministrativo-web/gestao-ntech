import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarLog } from "@/lib/log";
import { lerTicket, type TicketUpload } from "@/lib/tickets";
import { extensaoDe } from "@/lib/storage";
import { metadados } from "@/lib/storage/google";
import { tamanho as tamanhoLocal } from "@/lib/storage/local";
import { fmtRevisao } from "@/lib/utils";

// 2ª etapa do upload: confere que o arquivo chegou onde devia e registra a versão.
export async function POST(req: Request) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const t = await lerTicket<TicketUpload>("upload", body?.token ?? null);
  const fileId = typeof body?.fileId === "string" ? body.fileId : null;
  if (!t || t.uid !== u.id || !fileId) return NextResponse.json({ erro: "Upload inválido." }, { status: 400 });

  if (await db.arquivoVersao.findFirst({ where: { driveFileId: fileId } })) {
    return NextResponse.json({ erro: "Este upload já foi registrado." }, { status: 409 });
  }

  try {
    if (t.modo === "drive") {
      const meta = await metadados(fileId);
      if (!meta.parents?.includes(t.pastaId!) || Number(meta.size) !== t.tamanho) {
        return NextResponse.json({ erro: "O arquivo enviado não confere." }, { status: 400 });
      }
    } else if ((await tamanhoLocal(fileId)) !== t.tamanho) {
      return NextResponse.json({ erro: "O arquivo enviado não confere." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ erro: "Não foi possível conferir o arquivo enviado." }, { status: 400 });
  }

  // Mesmo nome na mesma etapa = nova revisão (R00 → R01 → R02...)
  const existente = t.arquivoId
    ? await db.arquivo.findUnique({ where: { id: t.arquivoId } })
    : await db.arquivo.findFirst({ where: { projetoId: t.projetoId, etapaId: t.etapaId, nome: t.nome } });

  const dadosVersao = {
    driveFileId: fileId,
    armazenamento: t.modo,
    nomeOriginal: t.nome,
    mimeType: t.mime,
    tamanho: t.tamanho,
    observacao: t.observacao,
    enviadoPorId: u.id,
  };

  if (existente) {
    const revisao = existente.revisaoAtual + 1;
    const versao = await db.$transaction(async (tx) => {
      await tx.arquivo.update({ where: { id: existente.id }, data: { revisaoAtual: revisao } });
      return tx.arquivoVersao.create({ data: { ...dadosVersao, arquivoId: existente.id, revisao } });
    });
    await registrarLog({
      acao: "NOVA_REVISAO",
      usuarioId: u.id,
      arquivoId: existente.id,
      versaoId: versao.id,
      detalhe: fmtRevisao(revisao),
    });
    return NextResponse.json({ arquivoId: existente.id, revisao });
  }

  const arquivo = await db.arquivo.create({
    data: {
      projetoId: t.projetoId,
      etapaId: t.etapaId,
      nome: t.nome,
      extensao: extensaoDe(t.nome),
      acessoEquipe: t.acessoEquipe ?? (t.etapaId ? "BAIXAR" : "VISUALIZAR"),
      versoes: { create: { ...dadosVersao, revisao: 0 } },
    },
    include: { versoes: true },
  });
  await registrarLog({ acao: "ENVIOU", usuarioId: u.id, arquivoId: arquivo.id, versaoId: arquivo.versoes[0].id, detalhe: "R00" });
  return NextResponse.json({ arquivoId: arquivo.id, revisao: 0 });
}
