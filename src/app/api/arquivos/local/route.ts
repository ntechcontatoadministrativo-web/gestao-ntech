import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { lerTicket, type TicketUpload } from "@/lib/tickets";
import { salvarStream, remover } from "@/lib/storage/local";

export const runtime = "nodejs";

// Recebe o arquivo no modo local (sem Google Drive conectado).
export async function PUT(req: Request) {
  const u = await usuarioAtual();
  const t = await lerTicket<TicketUpload>("upload", new URL(req.url).searchParams.get("t"));
  if (!u || !t || t.uid !== u.id || t.modo !== "local") {
    return NextResponse.json({ erro: "Upload não autorizado." }, { status: 403 });
  }
  if (!req.body) return NextResponse.json({ erro: "Arquivo vazio." }, { status: 400 });

  const { id, tamanho } = await salvarStream(req.body);
  if (tamanho !== t.tamanho) {
    await remover(id);
    return NextResponse.json({ erro: "O upload foi interrompido. Tente de novo." }, { status: 400 });
  }
  return NextResponse.json({ id, size: String(tamanho) });
}
