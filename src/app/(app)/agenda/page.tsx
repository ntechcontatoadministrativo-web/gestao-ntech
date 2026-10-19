import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn, diaBelem } from "@/lib/utils";
import { Cabecalho } from "@/components/ui";

export const metadata = { title: "Agenda" };

type Item = { id: string; dia: string; tipo: "etapa" | "tarefa" | "entrega"; titulo: string; detalhe: string; link: string; feito: boolean; atrasado: boolean };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

// Cores por tipo de item (identidade), sempre acompanhadas do rótulo do tipo.
const ESTILO = {
  etapa: "border-l-sky-400 bg-sky-400/10 text-sky-100",
  tarefa: "border-l-violet-400 bg-violet-400/10 text-violet-100",
  entrega: "border-l-neon bg-neon/10 text-neon-400",
} as const;
const ROTULO = { etapa: "Etapa", tarefa: "Tarefa", entrega: "Entrega" } as const;

export default async function Agenda({ searchParams }: { searchParams: { mes?: string; pessoa?: string } }) {
  const u = await exigirUsuario();
  const gestor = u.perfil === "GESTOR";
  const hoje = diaBelem();
  const [ano, mes] = (/^\d{4}-\d{2}$/.test(searchParams.mes ?? "") ? searchParams.mes! : hoje.slice(0, 7)).split("-").map(Number);

  // Grade de segunda a domingo cobrindo o mês inteiro.
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1, 15));
  const deslocamento = (primeiro.getUTCDay() + 6) % 7;
  const inicioGrade = new Date(primeiro.getTime() - deslocamento * 86400000);
  const ultimo = new Date(Date.UTC(ano, mes, 0, 15));
  const semanas = Math.ceil((deslocamento + ultimo.getUTCDate()) / 7);
  const dias = Array.from({ length: semanas * 7 }, (_, i) => new Date(inicioGrade.getTime() + i * 86400000).toISOString().slice(0, 10));
  const ini = new Date(`${dias[0]}T03:00:00Z`);
  const fim = new Date(new Date(`${dias[dias.length - 1]}T03:00:00Z`).getTime() + 86400000);

  const pessoa = gestor ? searchParams.pessoa || null : u.id;
  const [etapas, tarefas, projetos, pessoas] = await Promise.all([
    db.etapa.findMany({
      where: { prazo: { gte: ini, lt: fim }, projeto: { status: { in: ["ATIVO", "PAUSADO"] } }, ...(pessoa ? { responsavelId: pessoa } : {}) },
      include: { projeto: { select: { id: true, codigo: true } }, responsavel: { select: { nome: true } } },
    }),
    db.tarefa.findMany({
      where: { prazo: { gte: ini, lt: fim }, status: { not: "CANCELADA" }, ...(pessoa ? { responsavelId: pessoa } : {}) },
      include: { responsavel: { select: { nome: true } }, projeto: { select: { codigo: true } } },
    }),
    gestor && !pessoa
      ? db.projeto.findMany({ where: { prazoFinal: { gte: ini, lt: fim }, status: { in: ["ATIVO", "PAUSADO"] } }, select: { id: true, codigo: true, nome: true, prazoFinal: true } })
      : Promise.resolve([]),
    gestor ? db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : Promise.resolve([]),
  ]);

  const itens: Item[] = [
    ...etapas.map((e) => ({
      id: e.id,
      dia: diaBelem(e.prazo!),
      tipo: "etapa" as const,
      titulo: e.nome,
      detalhe: `${e.projeto.codigo}${gestor && e.responsavel ? ` · ${e.responsavel.nome.split(" ")[0]}` : ""}`,
      link: `/projetos/${e.projeto.id}/etapas/${e.id}`,
      feito: e.status === "CONCLUIDA",
      atrasado: e.status !== "CONCLUIDA" && diaBelem(e.prazo!) < hoje,
    })),
    ...tarefas.map((t) => ({
      id: t.id,
      dia: diaBelem(t.prazo!),
      tipo: "tarefa" as const,
      titulo: t.titulo,
      detalhe: `${t.projeto?.codigo ?? "Sem projeto"}${gestor && t.responsavel ? ` · ${t.responsavel.nome.split(" ")[0]}` : ""}`,
      link: `/tarefas?t=${t.id}#${t.id}`,
      feito: t.status === "FEITA",
      atrasado: t.status !== "FEITA" && diaBelem(t.prazo!) < hoje,
    })),
    ...projetos.map((p) => ({
      id: p.id,
      dia: diaBelem(p.prazoFinal!),
      tipo: "entrega" as const,
      titulo: `Entrega ${p.codigo}`,
      detalhe: p.nome,
      link: `/projetos/${p.id}`,
      feito: false,
      atrasado: diaBelem(p.prazoFinal!) < hoje,
    })),
  ];
  const porDia = new Map<string, Item[]>();
  for (const it of itens) porDia.set(it.dia, [...(porDia.get(it.dia) ?? []), it]);

  const mesStr = (a: number, m: number) => `${a}-${String(m).padStart(2, "0")}`;
  const ant = mes === 1 ? mesStr(ano - 1, 12) : mesStr(ano, mes - 1);
  const prox = mes === 12 ? mesStr(ano + 1, 1) : mesStr(ano, mes + 1);
  const q = (m: string) => `/agenda?mes=${m}${searchParams.pessoa ? `&pessoa=${searchParams.pessoa}` : ""}`;
  const mesAtual = mesStr(ano, mes);
  const doMes = itens.filter((i) => i.dia.startsWith(mesAtual)).sort((a, b) => a.dia.localeCompare(b.dia));

  const Cartao = ({ it, compacto }: { it: Item; compacto?: boolean }) => (
    <Link
      href={it.link}
      title={`${ROTULO[it.tipo]}: ${it.titulo} — ${it.detalhe}`}
      className={cn(
        "block rounded-md border-l-2 px-1.5 py-1 text-[11px] leading-tight hover:brightness-125",
        ESTILO[it.tipo],
        it.feito && "opacity-45 line-through",
        it.atrasado && "ring-1 ring-red-400/60",
      )}
    >
      <span className="block truncate font-medium">{it.titulo}</span>
      {!compacto && <span className="block truncate opacity-75">{it.detalhe}</span>}
    </Link>
  );

  return (
    <>
      <Cabecalho
        eyebrow="Agenda"
        titulo={`${MESES[mes - 1][0].toUpperCase()}${MESES[mes - 1].slice(1)} de ${ano}`}
        descricao={gestor ? "Prazos de etapas, tarefas e entregas de projetos." : "Os prazos das suas etapas e tarefas."}
        acoes={
          <div className="flex items-center gap-2">
            {gestor && (
              <form className="flex gap-2">
                <input type="hidden" name="mes" value={mesAtual} />
                <select name="pessoa" defaultValue={searchParams.pessoa ?? ""} className="input py-2">
                  <option value="">Toda a equipe</option>
                  {pessoas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                <button className="btn-secundario">Filtrar</button>
              </form>
            )}
            <Link href={q(ant)} className="btn-secundario px-2.5" aria-label="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link href={q(hoje.slice(0, 7))} className="btn-secundario">
              Hoje
            </Link>
            <Link href={q(prox)} className="btn-secundario px-2.5" aria-label="Próximo mês">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink-400">
        {(Object.keys(ROTULO) as (keyof typeof ROTULO)[]).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className={cn("h-3 w-1 rounded-sm border-l-2", ESTILO[t])} /> {ROTULO[t]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm ring-1 ring-red-400/60" /> Atrasado
        </span>
      </div>

      {/* Grade do mês (tablet e desktop) */}
      <section className="card hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b border-ink-700 bg-ink-900">
          {SEMANA.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-ink-400">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dias.map((d) => {
            const lista = porDia.get(d) ?? [];
            const foraDoMes = !d.startsWith(mesAtual);
            return (
              <div key={d} className={cn("min-h-[112px] border-b border-r border-ink-800 p-1.5", foraDoMes && "bg-ink-900/50")}>
                <div className={cn("mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs", d === hoje ? "bg-neon font-bold text-ink-950" : foraDoMes ? "text-ink-600" : "text-ink-300")}>
                  {Number(d.slice(8))}
                </div>
                <div className="space-y-1">
                  {lista.slice(0, 3).map((it) => (
                    <Cartao key={it.tipo + it.id} it={it} compacto={lista.length > 2} />
                  ))}
                  {lista.length > 3 && <div className="px-1 text-[10px] text-ink-400">+{lista.length - 3} mais</div>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Lista do mês (celular, e como versão em texto da grade) */}
      <section className="card md:mt-6">
        <div className="border-b border-ink-700 px-5 py-4">
          <h2 className="font-semibold text-white">Prazos do mês ({doMes.length})</h2>
        </div>
        {doMes.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">Nenhum prazo neste mês.</p>
        ) : (
          <ul className="divide-y divide-ink-800">
            {doMes.map((it) => (
              <li key={it.tipo + it.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className={cn("w-12 shrink-0 text-xs tabular-nums", it.dia === hoje ? "font-bold text-neon" : "text-ink-400")}>{it.dia.slice(8)}/{it.dia.slice(5, 7)}</span>
                <span className="w-16 shrink-0 text-[11px] uppercase tracking-wider text-ink-500">{ROTULO[it.tipo]}</span>
                <Link href={it.link} className={cn("min-w-0 flex-1 truncate text-sm hover:text-neon", it.feito ? "text-ink-500 line-through" : "text-ink-100")}>
                  {it.titulo} <span className="text-ink-500">· {it.detalhe}</span>
                </Link>
                {it.atrasado && <span className="text-[11px] font-semibold text-red-300">atrasado</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
