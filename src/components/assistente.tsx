"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, Maximize2, MessageSquareText, SendHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { papel: "usuario" | "assistente"; texto: string; erro?: boolean };

const CHAVE = "ntech.assistente.v1";

// Markdown mínimo: **negrito**, `código`, listas com "-"/"1." e títulos "#".
function inline(t: string) {
  return t.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-white">
        {p.slice(2, -2)}
      </strong>
    ) : p.startsWith("`") && p.endsWith("`") ? (
      <code key={i} className="rounded bg-ink-700 px-1 text-[12px]">
        {p.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

function Markdown({ texto }: { texto: string }) {
  const blocos: React.ReactNode[] = [];
  let lista: { ordenada: boolean; itens: string[] } | null = null;
  const fechar = () => {
    if (!lista) return;
    const L = lista.ordenada ? "ol" : "ul";
    blocos.push(
      <L key={blocos.length} className={cn("my-1.5 space-y-1 pl-5", lista.ordenada ? "list-decimal" : "list-disc")}>
        {lista.itens.map((it, i) => (
          <li key={i}>{inline(it)}</li>
        ))}
      </L>,
    );
    lista = null;
  };
  for (const linha of texto.split("\n")) {
    const ul = linha.match(/^\s*[-•*]\s+(.*)/);
    const ol = linha.match(/^\s*\d+[.)]\s+(.*)/);
    const h = linha.match(/^#{1,4}\s+(.*)/);
    if (ul || ol) {
      const ordenada = !!ol;
      if (lista && lista.ordenada !== ordenada) fechar();
      lista ??= { ordenada, itens: [] };
      lista.itens.push((ul ?? ol)![1]);
      continue;
    }
    fechar();
    if (h) blocos.push(<div key={blocos.length} className="mb-1 mt-3 font-semibold text-white first:mt-0">{inline(h[1])}</div>);
    else if (linha.trim()) blocos.push(<p key={blocos.length} className="my-1.5">{inline(linha)}</p>);
  }
  fechar();
  return <>{blocos}</>;
}

export function Chat({ sugestoes, compacto }: { sugestoes: string[]; compacto?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  // A conversa fica só neste navegador (conveniência); o sistema não guarda o chat.
  useEffect(() => {
    try {
      const salvo = sessionStorage.getItem(CHAVE);
      if (salvo) setMsgs(JSON.parse(salvo));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify(msgs.slice(-30)));
    } catch {}
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, carregando]);

  async function perguntar(p: string) {
    const pergunta = p.trim();
    if (!pergunta || carregando) return;
    const historico = msgs.filter((m) => !m.erro).map(({ papel, texto }) => ({ papel, texto }));
    setMsgs((v) => [...v, { papel: "usuario", texto: pergunta }]);
    setTexto("");
    setCarregando(true);
    try {
      const r = await fetch("/api/ia/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta, historico }),
      });
      const j = await r.json();
      setMsgs((v) => [...v, r.ok ? { papel: "assistente", texto: j.texto } : { papel: "assistente", texto: j.erro ?? "Erro.", erro: true }]);
    } catch {
      setMsgs((v) => [...v, { papel: "assistente", texto: "Sem conexão com o servidor.", erro: true }]);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("min-h-0 flex-1 space-y-4 overflow-y-auto", compacto ? "p-4" : "p-5")}>
        {msgs.length === 0 && (
          <div className="py-6 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-neon" />
            <div className="mt-3 font-semibold text-white">Pergunte sobre a equipe e os projetos</div>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-400">A IA consulta os registros do sistema: atividades, etapas, tarefas, horas e acessos a arquivos.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {sugestoes.map((s) => (
                <button key={s} type="button" onClick={() => perguntar(s)} className="rounded-full border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-ink-200 hover:border-neon/50 hover:text-neon">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) =>
          m.papel === "usuario" ? (
            <div key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-neon/15 px-4 py-2.5 text-sm text-ink-100">
              {m.texto}
            </div>
          ) : (
            <div
              key={i}
              className={cn(
                "max-w-[92%] rounded-2xl rounded-tl-sm border px-4 py-2.5 text-sm leading-relaxed",
                m.erro ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-ink-700 bg-ink-900 text-ink-200",
              )}
            >
              <Markdown texto={m.texto} />
            </div>
          ),
        )}
        {carregando && (
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-neon" /> Consultando os registros…
          </div>
        )}
        <div ref={fim} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          perguntar(texto);
        }}
        className="flex items-end gap-2 border-t border-ink-700 p-3"
      >
        {msgs.length > 0 && (
          <button type="button" onClick={() => setMsgs([])} className="btn-fantasma px-2 py-2.5" title="Limpar conversa" aria-label="Limpar conversa">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              perguntar(texto);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Ex.: o que o Yuri fez hoje?"
          className="input max-h-32 min-h-[42px] flex-1 resize-none py-2.5"
        />
        <button className="btn-primario px-3 py-2.5" disabled={!texto.trim() || carregando} aria-label="Enviar">
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

// Botão flutuante disponível em todas as telas.
export function AssistenteFlutuante({ sugestoes }: { sugestoes: string[] }) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();
  if (pathname === "/assistente") return null;
  return (
    <>
      {aberto && (
        <div className="fixed inset-x-3 bottom-20 top-20 z-40 flex flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-850 shadow-2xl sm:inset-x-auto sm:right-5 sm:top-auto sm:h-[600px] sm:w-[420px]">
          <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4 text-neon" /> Assistente NTECH
            </div>
            <div className="flex gap-1">
              <a href="/assistente" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-700 hover:text-white" title="Abrir em tela cheia" aria-label="Tela cheia">
                <Maximize2 className="h-4 w-4" />
              </a>
              <button onClick={() => setAberto(false)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-700 hover:text-white" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <Chat sugestoes={sugestoes} compacto />
        </div>
      )}
      <button
        onClick={() => setAberto((v) => !v)}
        className="fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-neon px-4 font-semibold text-ink-950 shadow-lg shadow-neon/20 hover:bg-neon-400"
        aria-label="Abrir assistente de IA"
      >
        {aberto ? <X className="h-5 w-5" /> : <MessageSquareText className="h-5 w-5" />}
        <span className="hidden text-sm sm:inline">{aberto ? "Fechar" : "Perguntar à IA"}</span>
      </button>
    </>
  );
}
