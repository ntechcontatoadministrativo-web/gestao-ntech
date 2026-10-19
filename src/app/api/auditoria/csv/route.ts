import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { db } from "@/lib/db";
import { filtroAuditoria, ROTULO_ACAO } from "@/lib/consultas";
import { fmtDataHora, fmtRevisao } from "@/lib/utils";

export async function GET(req: Request) {
  const u = await usuarioAtual();
  if (!u || u.perfil !== "GESTOR") return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });

  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const logs = await db.logAcesso.findMany({
    where: filtroAuditoria(sp),
    include: {
      usuario: { select: { nome: true, email: true } },
      arquivo: { select: { nome: true, projeto: { select: { codigo: true } } } },
      versao: { select: { revisao: true } },
    },
    orderBy: { criadoEm: "desc" },
    take: 50000,
  });

  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const linhas = [
    ["Data/hora", "Pessoa", "E-mail", "Ação", "Projeto", "Arquivo", "Revisão", "Detalhe", "IP"].join(";"),
    ...logs.map((l) =>
      [
        fmtDataHora(l.criadoEm),
        l.usuario?.nome,
        l.usuario?.email,
        ROTULO_ACAO[l.acao],
        l.arquivo?.projeto.codigo,
        l.arquivo?.nome,
        l.versao ? fmtRevisao(l.versao.revisao) : "",
        l.detalhe,
        l.ip,
      ]
        .map(esc)
        .join(";"),
    ),
  ];

  return new Response("﻿" + linhas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
