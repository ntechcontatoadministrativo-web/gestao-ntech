import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { db } from "@/lib/db";
import { filtroArquivosVisiveis } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

type Resultado = { tipo: "projeto" | "etapa" | "tarefa" | "arquivo" | "pessoa" | "cliente" | "chamado"; titulo: string; detalhe: string; link: string };

// Busca global (Ctrl+K). Cada perfil só encontra o que já pode ver.
export async function GET(req: Request) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (q.length < 2) return NextResponse.json({ resultados: [] });
  const gestor = u.perfil === "GESTOR";
  const contem = { contains: q, mode: "insensitive" as const };

  const numero = /^#?\d{1,7}$/.test(q) ? Number(q.replace("#", "")) : null;
  const [projetos, etapas, tarefas, arquivos, pessoas, clientes, chamados] = await Promise.all([
    db.projeto.findMany({
      where: {
        AND: [
          { OR: [{ nome: contem }, { codigo: contem }, { cliente: contem }] },
          gestor ? {} : { OR: [{ etapas: { some: { responsavelId: u.id } } }, { tarefas: { some: { responsavelId: u.id } } }] },
        ],
      },
      select: { id: true, codigo: true, nome: true, cliente: true, status: true },
      take: 6,
    }),
    db.etapa.findMany({
      where: { nome: contem, ...(gestor ? {} : { responsavelId: u.id }) },
      select: { id: true, nome: true, projeto: { select: { id: true, codigo: true } }, responsavel: { select: { nome: true } } },
      take: 6,
    }),
    db.tarefa.findMany({
      where: {
        OR: [{ titulo: contem }, { descricao: contem }, ...(numero ? [{ numero }] : [])],
        ...(gestor ? {} : { OR: [{ responsavelId: u.id }, { responsavelId: null }] }),
      },
      select: { id: true, numero: true, titulo: true, status: true, responsavel: { select: { nome: true } } },
      orderBy: { criadoEm: "desc" },
      take: 6,
    }),
    db.arquivo.findMany({
      where: { AND: [{ nome: contem }, gestor ? {} : filtroArquivosVisiveis(u.id)] },
      select: { id: true, nome: true, revisaoAtual: true, projeto: { select: { codigo: true } } },
      orderBy: { atualizadoEm: "desc" },
      take: 8,
    }),
    gestor
      ? db.usuario.findMany({ where: { OR: [{ nome: contem }, { email: contem }, { cargo: contem }] }, select: { id: true, nome: true, cargo: true, email: true }, take: 5 })
      : Promise.resolve([]),
    gestor
      ? db.cliente.findMany({ where: { OR: [{ nome: contem }, { razaoSocial: contem }, { documento: contem }, { contatoNome: contem }] }, select: { id: true, nome: true, contatoNome: true }, take: 5 })
      : Promise.resolve([]),
    db.chamado.findMany({
      where: { OR: [{ titulo: contem }, { solicitante: contem }, ...(numero ? [{ numero }] : [])] },
      select: { id: true, numero: true, titulo: true, status: true, cliente: { select: { nome: true } } },
      orderBy: { criadoEm: "desc" },
      take: 6,
    }),
  ]);

  const resultados: Resultado[] = [
    ...projetos.map((p) => ({ tipo: "projeto" as const, titulo: `${p.codigo} · ${p.nome}`, detalhe: p.cliente ?? p.status.toLowerCase(), link: `/projetos/${p.id}` })),
    ...etapas.map((e) => ({
      tipo: "etapa" as const,
      titulo: e.nome,
      detalhe: `${e.projeto.codigo}${e.responsavel ? ` · ${e.responsavel.nome}` : ""}`,
      link: `/projetos/${e.projeto.id}/etapas/${e.id}`,
    })),
    ...tarefas.map((t) => ({
      tipo: "tarefa" as const,
      titulo: `#${t.numero} ${t.titulo}`,
      detalhe: `${t.responsavel?.nome ?? "sem dono"} · ${t.status.replace("_", " ").toLowerCase()}`,
      link: `/tarefas?t=${t.id}&status=todas#${t.id}`,
    })),
    ...chamados.map((c) => ({
      tipo: "chamado" as const,
      titulo: `#${c.numero} ${c.titulo}`,
      detalhe: `${c.cliente?.nome ?? "sem cliente"} · ${c.status.replace(/_/g, " ").toLowerCase()}`,
      link: `/chamados/${c.id}`,
    })),
    ...clientes.map((c) => ({ tipo: "cliente" as const, titulo: c.nome, detalhe: c.contatoNome ?? "cliente", link: `/clientes/${c.id}` })),
    ...arquivos.map((a) => ({
      tipo: "arquivo" as const,
      titulo: a.nome,
      detalhe: `${a.projeto.codigo} · R${String(a.revisaoAtual).padStart(2, "0")}`,
      link: `/arquivos/${a.id}`,
    })),
    ...pessoas.map((p) => ({ tipo: "pessoa" as const, titulo: p.nome, detalhe: p.cargo ?? p.email, link: `/equipe/${p.id}` })),
  ];
  return NextResponse.json({ resultados });
}
