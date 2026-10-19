"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type EstadoForm = { erro?: string; ok?: string; dados?: Record<string, string> } | null;
type Acao = (estado: EstadoForm, fd: FormData) => Promise<EstadoForm>;

export function BotaoEnviar({
  children,
  className = "btn-primario",
  pendente,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendente?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || rest.disabled} className={className} {...rest}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending && pendente ? pendente : children}
    </button>
  );
}

// Formulário ligado a uma server action que devolve { erro } ou { ok }.
export function Formulario({
  acao,
  children,
  className,
  aoConcluir,
  resetar,
}: {
  acao: Acao;
  children: React.ReactNode;
  className?: string;
  aoConcluir?: (estado: NonNullable<EstadoForm>) => void;
  resetar?: boolean;
}) {
  const [estado, despachar] = useFormState(acao, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) {
      if (resetar) ref.current?.reset();
      aoConcluir?.(estado);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);
  return (
    <form ref={ref} action={despachar} className={className}>
      {children}
      {estado?.erro && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{estado.erro}</div>
      )}
      {estado?.ok && !aoConcluir && (
        <div className="mt-3 rounded-lg border border-neon/30 bg-neon/10 px-3 py-2 text-sm text-neon-400">{estado.ok}</div>
      )}
    </form>
  );
}

export function Modal({
  gatilho,
  titulo,
  children,
  largura = "max-w-lg",
}: {
  gatilho: (abrir: () => void) => React.ReactNode;
  titulo: string;
  children: (fechar: () => void) => React.ReactNode;
  largura?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [aberto, setAberto] = useState(false);
  const abrir = () => {
    setAberto(true);
    ref.current?.showModal();
  };
  const fechar = () => {
    ref.current?.close();
    setAberto(false);
  };
  return (
    <>
      {gatilho(abrir)}
      <dialog
        ref={ref}
        onClose={() => setAberto(false)}
        onClick={(e) => e.target === ref.current && fechar()}
        className={cn("w-[calc(100%-2rem)] rounded-2xl border border-ink-600 bg-ink-850 p-0 text-ink-100 shadow-2xl", largura)}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
          <h2 className="font-semibold text-white">{titulo}</h2>
          <button type="button" onClick={fechar} className="rounded-lg p-1 text-ink-400 hover:bg-ink-700 hover:text-white" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{aberto && children(fechar)}</div>
      </dialog>
    </>
  );
}

// Botão que executa uma server action após confirmação, sem usar confirm() do navegador.
export function BotaoConfirmar({
  acao,
  children,
  mensagem,
  className = "btn-perigo btn-sm",
  rotuloConfirmar = "Confirmar",
}: {
  acao: () => Promise<unknown>;
  children: React.ReactNode;
  mensagem: string;
  className?: string;
  rotuloConfirmar?: string;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [rodando, setRodando] = useState(false);
  if (!confirmando)
    return (
      <button type="button" className={className} onClick={() => setConfirmando(true)}>
        {children}
      </button>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs text-ink-300">
      {mensagem}
      <button
        type="button"
        disabled={rodando}
        className="btn-perigo btn-sm"
        onClick={async () => {
          setRodando(true);
          try {
            await acao();
          } finally {
            setRodando(false);
            setConfirmando(false);
          }
        }}
      >
        {rodando && <Loader2 className="h-3 w-3 animate-spin" />}
        {rotuloConfirmar}
      </button>
      <button type="button" className="btn-fantasma btn-sm" onClick={() => setConfirmando(false)}>
        Cancelar
      </button>
    </span>
  );
}

// Mantém o indicador "online" atualizado enquanto a aba estiver aberta.
export function Presenca() {
  useEffect(() => {
    const pingar = () => {
      if (document.visibilityState === "visible") fetch("/api/presenca", { method: "POST" })
          .then(async (r) => {
            // Usuário desativado pelo gestor: sai na hora.
            if (r.status === 401) window.location.href = "/login";
            const j = await r.json().catch(() => null);
            if (typeof j?.avisos === "number") window.dispatchEvent(new CustomEvent("ntech:avisos", { detail: j.avisos }));
          })
          .catch(() => {});
    };
    pingar();
    const t = setInterval(pingar, 45_000);
    document.addEventListener("visibilitychange", pingar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", pingar);
    };
  }, []);
  return null;
}

// Envia o formulário automaticamente ao trocar o valor de um <select>.
export function SelectAuto(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
