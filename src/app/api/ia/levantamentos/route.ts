import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { db } from "@/lib/db";
import { executarLevantamento, iaConfigurada, LIMITES, tipoSuportado, type DocumentoEntrada } from "@/lib/ia/levantamento";
import { mimeDe } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

// Recebe os documentos do cliente, cria o levantamento e dispara a análise em segundo plano.
export async function POST(req: Request) {
  const u = await usuarioAtual();
  if (!u || u.perfil !== "GESTOR") return NextResponse.json({ erro: "Apenas gestores." }, { status: 403 });
  if (!iaConfigurada()) return NextResponse.json({ erro: "IA não configurada: defina ANTHROPIC_API_KEY no servidor." }, { status: 503 });

  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ erro: "Envio inválido." }, { status: 400 });

  const titulo = String(fd.get("titulo") ?? "").trim();
  if (!titulo) return NextResponse.json({ erro: "Dê um nome ao projeto." }, { status: 400 });

  const arquivos = fd.getAll("arquivos").filter((a): a is File => a instanceof File && a.size > 0);
  const briefing = String(fd.get("observacoes") ?? "").trim();
  if (!arquivos.length && briefing.length < 40) return NextResponse.json({ erro: "Envie um documento ou escreva o briefing (pelo menos algumas frases)." }, { status: 400 });
  if (arquivos.length > LIMITES.arquivos) return NextResponse.json({ erro: `Máximo de ${LIMITES.arquivos} arquivos por escopo.` }, { status: 400 });

  const total = arquivos.reduce((s, a) => s + a.size, 0);
  if (total > LIMITES.totalBytes) {
    return NextResponse.json({ erro: "Os arquivos passam de 22 MB no total. Envie só os principais." }, { status: 413 });
  }

  const documentos: DocumentoEntrada[] = [];
  for (const a of arquivos) {
    const tipo = mimeDe(a.name, a.type);
    if (!tipoSuportado(tipo, a.name)) {
      return NextResponse.json({ erro: `"${a.name}": formato não suportado. Use PDF, imagens (JPG/PNG/WEBP) ou texto. Exporte DOCX/Figma para PDF.` }, { status: 400 });
    }
    if (tipo.startsWith("image/") && a.size > LIMITES.imagemBytes) {
      return NextResponse.json({ erro: `"${a.name}": imagens precisam ter até 5 MB.` }, { status: 413 });
    }
    documentos.push({ nome: a.name, tipo, dados: Buffer.from(await a.arrayBuffer()) });
  }

  const cliente = String(fd.get("cliente") ?? "").trim() || null;
  const observacoes = briefing.slice(0, 20000) || null;
  const lev = await db.levantamento.create({
    data: {
      titulo: titulo.slice(0, 200),
      cliente,
      observacoes,
      documentos: documentos.map((d) => ({ nome: d.nome, tipo: d.tipo, tamanho: d.dados.length })),
      criadoPorId: u.id,
    },
  });

  // Não espera: a tela acompanha o status e atualiza quando terminar.
  void executarLevantamento(lev.id, { titulo, cliente, observacoes, documentos });
  return NextResponse.json({ id: lev.id });
}
