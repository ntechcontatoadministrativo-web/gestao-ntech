import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarLog } from "@/lib/log";
import { nivelNoArquivo, podeBaixar, podeVer } from "@/lib/permissoes";
import { lerTicket, type TicketVer } from "@/lib/tickets";
import { abrirConteudo } from "@/lib/storage";
import { fmtRevisao } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nomeDownload(nome: string, revisao: number) {
  const i = nome.lastIndexOf(".");
  const base = i > 0 ? nome.slice(0, i) : nome;
  const ext = i > 0 ? nome.slice(i) : "";
  return `${base} - ${fmtRevisao(revisao)}${ext}`;
}

function contentDisposition(tipo: "inline" | "attachment", nome: string) {
  const ascii = nome.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

// Único caminho até o conteúdo dos arquivos: confere a permissão a cada requisição,
// então um bloqueio feito pelo gestor vale na hora.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const url = new URL(req.url);
  const modo = url.searchParams.get("modo") === "ver" ? "ver" : "baixar";
  const versaoId = url.searchParams.get("v");
  const range = req.headers.get("range");
  const primeiraParte = !range || /^bytes=0-/.test(range);

  const arquivo = await db.arquivo.findUnique({
    where: { id: params.id },
    include: { versoes: { where: versaoId ? { id: versaoId } : {}, orderBy: { revisao: "desc" }, take: 1 } },
  });
  const versao = arquivo?.versoes[0];
  if (!arquivo || !versao) return NextResponse.json({ erro: "Arquivo não encontrado" }, { status: 404 });

  // A visualização só funciona a partir da tela do sistema (que registra o acesso).
  if (modo === "ver") {
    const t = await lerTicket<TicketVer>("ver", url.searchParams.get("t"));
    if (!t || t.uid !== u.id || t.versaoId !== versao.id) {
      return NextResponse.json({ erro: "Abra o arquivo pelo sistema." }, { status: 403 });
    }
  }

  const nivel = await nivelNoArquivo(u, arquivo.id);
  const permitido = modo === "ver" ? podeVer(nivel) : podeBaixar(nivel);

  if (!permitido) {
    if (primeiraParte) {
      await registrarLog({
        acao: "ACESSO_NEGADO",
        usuarioId: u.id,
        arquivoId: arquivo.id,
        versaoId: versao.id,
        detalhe: modo === "ver" ? "Visualização" : "Download",
      });
    }
    return NextResponse.json({ erro: "Acesso a este arquivo bloqueado." }, { status: 403 });
  }

  if (modo === "baixar" && primeiraParte) {
    await registrarLog({ acao: "BAIXOU", usuarioId: u.id, arquivoId: arquivo.id, versaoId: versao.id, detalhe: fmtRevisao(versao.revisao) });
  }

  try {
    const { corpo, status, headers } = await abrirConteudo(versao, range);
    return new Response(corpo, {
      status,
      headers: {
        ...headers,
        "Content-Type": versao.mimeType,
        "Content-Disposition": contentDisposition(modo === "ver" ? "inline" : "attachment", nomeDownload(arquivo.nome, versao.revisao)),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Falha ao ler o arquivo." }, { status: 502 });
  }
}
