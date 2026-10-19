import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { periodoRelatorio, relatorioProdutividade } from "@/lib/relatorios";

export async function GET(req: Request) {
  const u = await usuarioAtual();
  if (!u || u.perfil !== "GESTOR") return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { de, ate, ini, fim } = periodoRelatorio(sp);
  const { pessoas, projetos } = await relatorioProdutividade(ini, fim);

  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const horas = (m: number) => (m / 60).toFixed(2).replace(".", ",");
  const linhas = [
    `Relatório de produtividade;${de};${ate}`,
    "",
    ["Pessoa", "Cargo", "Horas", "Etapas concluídas", "Etapas no prazo", "Tarefas concluídas", "Tarefas no prazo", "Atrasadas em aberto", "Arquivos enviados", "Downloads"].join(";"),
    ...pessoas.map((p) =>
      [p.nome, p.cargo, horas(p.minutos), p.etapasConcluidas, p.etapasNoPrazo, p.tarefasConcluidas, p.tarefasNoPrazo, p.abertasAtrasadas, p.envios, p.downloads].map(esc).join(";"),
    ),
    "",
    ["Projeto", "Nome", "Status", "Horas", "Progresso (%)", "Etapas concluídas"].join(";"),
    ...projetos.map((p) => [p.codigo, p.nome, p.status, horas(p.minutos), p.progresso, p.etapasConcluidas].map(esc).join(";")),
  ];
  return new Response("﻿" + linhas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="produtividade-${de}-a-${ate}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
