import Link from "next/link";
import { FolderKanban, Plus, Search } from "lucide-react";
import type { Prisma, StatusProjeto } from "@prisma/client";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { etapaAtrasada, etapaAtual, progresso } from "@/lib/consultas";
import { filtroArquivosVisiveis } from "@/lib/permissoes";
import { cn, fmtData } from "@/lib/utils";
import { Badge, Cabecalho, Progresso, ROTULO_PROJETO, StatusProjetoBadge, TipoProjetoBadge, Vazio } from "@/components/ui";

export const metadata = { title: "Projetos" };

const FILTROS: (StatusProjeto | "TODOS")[] = ["ATIVO", "PAUSADO", "CONCLUIDO", "CANCELADO", "TODOS"];

export default async function Projetos({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  const u = await exigirUsuario();
  const status = (FILTROS.includes(searchParams.status as StatusProjeto) ? searchParams.status : "ATIVO") as StatusProjeto | "TODOS";
  const q = searchParams.q?.trim();

  const filtros: Prisma.ProjetoWhereInput[] = [];
  if (status !== "TODOS") filtros.push({ status });
  if (q) {
    filtros.push({
      OR: [
        { nome: { contains: q, mode: "insensitive" } },
        { codigo: { contains: q, mode: "insensitive" } },
        { cliente: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (u.perfil !== "GESTOR") {
    filtros.push({
      OR: [
        { etapas: { some: { responsavelId: u.id } } },
        { tarefas: { some: { responsavelId: u.id } } },
        { chamados: { some: { responsavelId: u.id } } },
        { arquivos: { some: filtroArquivosVisiveis(u.id) } },
      ],
    });
  }
  const where: Prisma.ProjetoWhereInput = { AND: filtros };

  const [projetos, contagem] = await Promise.all([
    db.projeto.findMany({
      where,
      include: {
        etapas: { include: { responsavel: { select: { nome: true } } } },
        tarefas: { where: { status: { in: ["A_FAZER", "FAZENDO", "REVISAO"] } }, select: { responsavelId: true } },
        sprints: { where: { status: "ATIVA" }, select: { nome: true } },
      },
      orderBy: [{ status: "asc" }, { prazoFinal: "asc" }, { criadoEm: "desc" }],
    }),
    u.perfil === "GESTOR" ? db.projeto.groupBy({ by: ["status"], _count: true }) : Promise.resolve([]),
  ]);
  const qtd = (s: StatusProjeto) => contagem.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <Cabecalho
        eyebrow="Projetos"
        titulo="Projetos"
        descricao={u.perfil === "GESTOR" ? "Software, sites, produtos e contratos de suporte da NTECH." : "Projetos em que você participa."}
        acoes={
          u.perfil === "GESTOR" && (
            <Link href="/projetos/novo" className="btn-primario">
              <Plus className="h-4 w-4" /> Novo projeto
            </Link>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <Link
              key={f}
              href={`/projetos?status=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                status === f ? "bg-neon text-ink-950" : "bg-ink-800 text-ink-300 hover:bg-ink-700",
              )}
            >
              {f === "TODOS" ? "Todos" : ROTULO_PROJETO[f]}
              {u.perfil === "GESTOR" && f !== "TODOS" && <span className="ml-1.5 opacity-60">{qtd(f)}</span>}
            </Link>
          ))}
        </div>
        <form className="relative md:w-72">
          <input type="hidden" name="status" value={status} />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input name="q" defaultValue={q} placeholder="Buscar por nome, código, cliente" className="input pl-9" />
        </form>
      </div>

      {projetos.length === 0 ? (
        <div className="card">
          <Vazio
            icone={<FolderKanban className="h-8 w-8" />}
            titulo="Nenhum projeto encontrado"
            texto={u.perfil === "GESTOR" ? "Crie um projeto (ou monte o escopo com IA) e as etapas padrão do tipo são geradas." : "Quando você tiver itens ou etapas num projeto, ele aparece aqui."}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projetos.map((p) => {
            const pct = progresso(p.etapas);
            const atual = etapaAtual(p.etapas);
            const atr = p.etapas.filter(etapaAtrasada).length;
            const equipe = new Set([...p.etapas.map((e) => e.responsavelId), ...p.tarefas.map((t) => t.responsavelId)].filter(Boolean));
            return (
              <Link key={p.id} href={`/projetos/${p.id}`} className="card group flex flex-col p-5 transition hover:border-ink-500">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-xs text-ink-400">{p.codigo}</span>
                  <div className="flex gap-1.5">
                    {atr > 0 && <Badge tom="vermelho">{atr} atrasada{atr > 1 && "s"}</Badge>}
                    <StatusProjetoBadge status={p.status} />
                  </div>
                </div>
                <h3 className="mt-2 font-semibold text-white group-hover:text-neon">{p.nome}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-400">
                  <TipoProjetoBadge tipo={p.tipo} />
                  {p.cliente && <span>{p.cliente}</span>}
                </div>
                {p.stack && <p className="mt-1.5 truncate font-mono text-[11px] text-ink-500">{p.stack}</p>}

                <div className="mt-4 flex items-center justify-between text-xs text-ink-400">
                  <span className="truncate">
                    {p.sprints[0] ? <span className="text-neon">{p.sprints[0].nome}</span> : atual ? `Em: ${atual.nome}` : p.etapas.length ? "Etapas concluídas" : "Sem etapas"}
                  </span>
                  <span className="font-semibold text-white">{pct}%</span>
                </div>
                <Progresso valor={pct} className="mt-2" />

                <div className="mt-4 flex items-center justify-between border-t border-ink-700 pt-3 text-xs text-ink-400">
                  <span>{p.prazoFinal ? `Entrega ${fmtData(p.prazoFinal)}` : "Sem prazo final"}</span>
                  <span>
                    {p.tarefas.length} itens abertos · {equipe.size} pessoa(s)
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
