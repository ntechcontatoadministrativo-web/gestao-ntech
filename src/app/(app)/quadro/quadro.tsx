"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import type { Prioridade, StatusTarefa, TipoTarefa } from "@prisma/client";
import { alterarStatusTarefa } from "@/actions/tarefas";
import { Avatar, Badge, Pontos, TipoTarefaIcone } from "@/components/ui";
import { cn } from "@/lib/utils";

export type CartaoQuadro = {
  id: string;
  numero: number;
  titulo: string;
  status: StatusTarefa;
  tipo: TipoTarefa;
  prioridade: Prioridade;
  pontos: number | null;
  prazo: string | null;
  atrasada: boolean;
  projeto: string | null;
  responsavel: { id: string; nome: string } | null;
  podeMover: boolean;
};

const COLUNAS: { status: StatusTarefa; rotulo: string; cor: string }[] = [
  { status: "BACKLOG", rotulo: "Backlog", cor: "bg-ink-500" },
  { status: "A_FAZER", rotulo: "A fazer", cor: "bg-ink-300" },
  { status: "FAZENDO", rotulo: "Fazendo", cor: "bg-sky-400" },
  { status: "REVISAO", rotulo: "Em revisão", cor: "bg-violet-400" },
  { status: "FEITA", rotulo: "Feito", cor: "bg-neon" },
];

export function Quadro({ cartoes, mostrarBacklog }: { cartoes: CartaoQuadro[]; mostrarBacklog: boolean }) {
  const [itens, setItens] = useState(cartoes);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<StatusTarefa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => setItens(cartoes), [cartoes]);

  const colunas = COLUNAS.filter((c) => mostrarBacklog || c.status !== "BACKLOG");

  function soltar(status: StatusTarefa) {
    const id = arrastando;
    setArrastando(null);
    setAlvo(null);
    const c = itens.find((i) => i.id === id);
    if (!c || c.status === status) return;
    if (!c.podeMover) {
      setErro(`#${c.numero} é de ${c.responsavel?.nome ?? "outra pessoa"}. Só o responsável ou o gestor move.`);
      return;
    }
    const antes = itens;
    setItens((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
    setErro(null);
    iniciar(async () => {
      try {
        await alterarStatusTarefa(c.id, status);
        router.refresh();
      } catch (e) {
        setItens(antes);
        setErro(e instanceof Error ? e.message : "Não foi possível mover o item.");
      }
    });
  }

  const alternarBacklog = () => {
    const p = new URLSearchParams(params.toString());
    if (mostrarBacklog) p.set("backlog", "0");
    else p.delete("backlog");
    router.push(`${pathname}?${p.toString()}`);
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        {erro ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200">{erro}</div> : <span />}
        <button className="btn-fantasma btn-sm" onClick={alternarBacklog}>
          {mostrarBacklog ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {mostrarBacklog ? "Esconder backlog" : "Mostrar backlog"}
        </button>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        <div className="grid min-w-[900px] gap-3" style={{ gridTemplateColumns: `repeat(${colunas.length}, minmax(0, 1fr))` }}>
          {colunas.map((col) => {
            const lista = itens.filter((i) => i.status === col.status);
            const pontos = lista.reduce((s, i) => s + (i.pontos ?? 0), 0);
            return (
              <section
                key={col.status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setAlvo(col.status);
                }}
                onDragLeave={() => setAlvo((a) => (a === col.status ? null : a))}
                onDrop={() => soltar(col.status)}
                className={cn(
                  "flex min-h-[60vh] flex-col rounded-2xl border bg-ink-900/60 transition",
                  alvo === col.status && arrastando ? "border-neon/50 bg-neon/[0.03]" : "border-ink-700",
                )}
              >
                <header className="flex items-center gap-2 px-3 py-3">
                  <span className={cn("h-2 w-2 rounded-full", col.cor)} />
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-200">{col.rotulo}</span>
                  <span className="rounded-md bg-ink-800 px-1.5 text-[11px] font-semibold text-ink-400">{lista.length}</span>
                  {pontos > 0 && <span className="ml-auto font-mono text-[11px] text-ink-500">{pontos} pts</span>}
                </header>
                <div className="flex-1 space-y-2 px-2 pb-2">
                  {lista.map((c) => (
                    <article
                      key={c.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        setArrastando(c.id);
                      }}
                      onDragEnd={() => {
                        setArrastando(null);
                        setAlvo(null);
                      }}
                      className={cn(
                        "group cursor-grab rounded-xl border border-ink-700 bg-ink-850 p-3 shadow-sm transition hover:border-ink-500 active:cursor-grabbing",
                        arrastando === c.id && "opacity-40",
                        c.prioridade === "URGENTE" && "border-l-2 border-l-red-400",
                        c.prioridade === "ALTA" && "border-l-2 border-l-amber-300",
                      )}
                    >
                      <div className="flex items-center gap-2 text-[11px] text-ink-400">
                        <TipoTarefaIcone tipo={c.tipo} />
                        <Link href={`/tarefas?t=${c.id}&status=todas#${c.id}`} className="font-mono hover:text-neon">
                          #{c.numero}
                        </Link>
                        {c.projeto && <span className="font-mono">{c.projeto}</span>}
                        {!c.podeMover && <Lock className="ml-auto h-3 w-3 text-ink-500" aria-label="Item de outra pessoa" />}
                      </div>
                      <Link href={`/tarefas?t=${c.id}&status=todas#${c.id}`} className="mt-1.5 block text-sm font-medium leading-snug text-ink-100 hover:text-neon">
                        {c.titulo}
                      </Link>
                      <div className="mt-2.5 flex items-center gap-1.5">
                        {c.responsavel ? <Avatar nome={c.responsavel.nome} tamanho="sm" /> : <span className="text-[11px] text-amber-300/80">sem dono</span>}
                        {c.prazo && (
                          <Badge tom={c.atrasada ? "vermelho" : "neutro"} className="font-mono">
                            {c.prazo.slice(8, 10)}/{c.prazo.slice(5, 7)}
                          </Badge>
                        )}
                        <span className="ml-auto">
                          <Pontos valor={c.pontos} />
                        </span>
                      </div>
                    </article>
                  ))}
                  {lista.length === 0 && <div className="rounded-xl border border-dashed border-ink-700 px-3 py-6 text-center text-[11px] text-ink-500">Solte aqui</div>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
