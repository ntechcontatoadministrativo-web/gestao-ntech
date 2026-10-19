"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckSquare, FileText, FolderKanban, LifeBuoy, Loader2, Search, User, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

type Resultado = { tipo: "projeto" | "etapa" | "tarefa" | "arquivo" | "pessoa" | "cliente" | "chamado"; titulo: string; detalhe: string; link: string };

const ICONE = { projeto: FolderKanban, etapa: Workflow, tarefa: CheckSquare, arquivo: FileText, pessoa: User, cliente: Building2, chamado: LifeBuoy };
const ROTULO = { projeto: "Projeto", etapa: "Etapa", tarefa: "Tarefa", arquivo: "Arquivo", pessoa: "Pessoa", cliente: "Cliente", chamado: "Chamado" };

export function BuscaGlobal() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Resultado[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  // Ctrl+K / Cmd+K abre a busca de qualquer tela.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto(true);
      }
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  useEffect(() => {
    if (aberto) setTimeout(() => input.current?.focus(), 20);
    else {
      setQ("");
      setRes([]);
    }
  }, [aberto]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setRes([]);
      return;
    }
    setCarregando(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/busca?q=${encodeURIComponent(q)}`, { signal: ctrl.signal }).then((x) => x.json());
        setRes(r.resultados ?? []);
        setSel(0);
      } catch {}
      setCarregando(false);
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const ir = (r: Resultado) => {
    setAberto(false);
    router.push(r.link);
  };

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-400 hover:border-ink-500 hover:text-ink-200"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="rounded bg-ink-700 px-1.5 py-0.5 font-mono text-[10px] text-ink-300">Ctrl K</kbd>
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={() => setAberto(false)}>
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-ink-600 bg-ink-850 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-ink-700 px-4">
              {carregando ? <Loader2 className="h-4 w-4 animate-spin text-ink-400" /> : <Search className="h-4 w-4 text-ink-400" />}
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSel((s) => Math.min(res.length - 1, s + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSel((s) => Math.max(0, s - 1));
                  } else if (e.key === "Enter" && res[sel]) ir(res[sel]);
                }}
                placeholder="Projeto, arquivo, tarefa, etapa ou pessoa…"
                className="h-14 flex-1 bg-transparent text-sm text-ink-100 outline-none placeholder:text-ink-500"
              />
              <kbd className="rounded bg-ink-700 px-1.5 py-0.5 font-mono text-[10px] text-ink-400">Esc</kbd>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto py-2">
              {q.trim().length >= 2 && !carregando && res.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-500">Nada encontrado para &quot;{q}&quot;.</li>}
              {q.trim().length < 2 && <li className="px-4 py-6 text-center text-xs text-ink-500">Digite ao menos 2 letras. Use ↑ ↓ e Enter para abrir.</li>}
              {res.map((r, i) => {
                const Icone = ICONE[r.tipo];
                return (
                  <li key={r.tipo + r.link}>
                    <button
                      onMouseEnter={() => setSel(i)}
                      onClick={() => ir(r)}
                      className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left", i === sel ? "bg-neon/10" : "hover:bg-ink-800")}
                    >
                      <Icone className={cn("h-4 w-4 shrink-0", i === sel ? "text-neon" : "text-ink-400")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink-100">{r.titulo}</span>
                        <span className="block truncate text-xs text-ink-500">{r.detalhe}</span>
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-ink-500">{ROTULO[r.tipo]}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
