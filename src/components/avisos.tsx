"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, CheckSquare, FileCheck2, FolderKanban, LifeBuoy, Loader2, MessageSquare, Rocket, ThumbsUp, Undo2, Workflow } from "lucide-react";
import { cn, tempoRelativo } from "@/lib/utils";

type Aviso = { id: string; tipo: string; titulo: string; texto: string | null; link: string | null; lidoEm: string | null; criadoEm: string };

const ICONES: Record<string, React.ElementType> = {
  chamado: LifeBuoy,
  deploy: Rocket,
  tarefa: CheckSquare,
  etapa: Workflow,
  aprovacao: ThumbsUp,
  devolucao: Undo2,
  comentario: MessageSquare,
  arquivo: FileCheck2,
  projeto: FolderKanban,
};

export const EVENTO_AVISOS = "ntech:avisos";

export function Sininho({ inicial, alinhar = "esquerda" }: { inicial: number; alinhar?: "esquerda" | "direita" }) {
  const router = useRouter();
  const [naoLidos, setNaoLidos] = useState(inicial);
  const [aberto, setAberto] = useState(false);
  const [avisos, setAvisos] = useState<Aviso[] | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  // O contador chega junto com o sinal de presença (a cada ~45s).
  useEffect(() => {
    const ouvir = (e: Event) => setNaoLidos((e as CustomEvent<number>).detail);
    window.addEventListener(EVENTO_AVISOS, ouvir);
    return () => window.removeEventListener(EVENTO_AVISOS, ouvir);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => caixa.current && !caixa.current.contains(e.target as Node) && setAberto(false);
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  async function abrir() {
    setAberto((v) => !v);
    const r = await fetch("/api/avisos").then((x) => x.json()).catch(() => null);
    if (r) {
      setAvisos(r.avisos);
      setNaoLidos(r.naoLidos);
    }
  }

  async function marcar(id?: string) {
    await fetch("/api/avisos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : {}) });
    setAvisos((v) => v?.map((a) => (!id || a.id === id ? { ...a, lidoEm: a.lidoEm ?? new Date().toISOString() } : a)) ?? null);
    setNaoLidos((n) => (id ? Math.max(0, n - 1) : 0));
  }

  return (
    <div ref={caixa} className="relative">
      <button onClick={abrir} className="relative rounded-lg p-2 text-ink-300 hover:bg-ink-800 hover:text-white" aria-label={`Avisos${naoLidos ? `: ${naoLidos} não lidos` : ""}`}>
        <Bell className="h-5 w-5" />
        {naoLidos > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-neon px-1 text-[10px] font-bold text-ink-950">
            {naoLidos > 99 ? "99+" : naoLidos}
          </span>
        )}
      </button>
      {aberto && (
        <div
          className={cn(
            "absolute top-11 z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-ink-600 bg-ink-850 shadow-2xl",
            alinhar === "direita" ? "right-0" : "left-0",
          )}
        >
          <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
            <span className="text-sm font-semibold text-white">Avisos</span>
            {naoLidos > 0 && (
              <button onClick={() => marcar()} className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-neon">
                <CheckCheck className="h-3.5 w-3.5" /> Marcar todos como lidos
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {avisos === null ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
              </div>
            ) : avisos.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-ink-500">Nenhum aviso por enquanto.</p>
            ) : (
              <ul className="divide-y divide-ink-800">
                {avisos.map((a) => {
                  const Icone = ICONES[a.tipo] ?? Bell;
                  return (
                    <li key={a.id}>
                      <button
                        onClick={async () => {
                          if (!a.lidoEm) await marcar(a.id);
                          setAberto(false);
                          if (a.link) router.push(a.link);
                        }}
                        className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-ink-800/60", !a.lidoEm && "bg-neon/[0.04]")}
                      >
                        <span className={cn("mt-0.5 shrink-0", a.lidoEm ? "text-ink-500" : "text-neon")}>
                          <Icone className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm", a.lidoEm ? "text-ink-300" : "font-medium text-white")}>{a.titulo}</span>
                          {a.texto && <span className="mt-0.5 line-clamp-2 block text-xs text-ink-400">{a.texto}</span>}
                          <span className="mt-1 block text-[11px] text-ink-500">{tempoRelativo(a.criadoEm)}</span>
                        </span>
                        {!a.lidoEm && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-neon" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
