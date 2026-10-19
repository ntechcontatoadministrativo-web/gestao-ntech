"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Sparkles, X } from "lucide-react";
import { cn, fmtTamanho } from "@/lib/utils";

const ACEITOS = ".pdf,.jpg,.jpeg,.png,.webp,.gif,.txt,.md,.csv";
const LIMITE_TOTAL = 22 * 1024 * 1024;

export function NovoLevantamento({ desabilitado }: { desabilitado: boolean }) {
  const [briefing, setBriefing] = useState("");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const total = arquivos.reduce((s, a) => s + a.size, 0);

  const adicionar = (lista: FileList | null) => lista && setArquivos((v) => [...v, ...Array.from(lista)]);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    fd.delete("arquivos");
    for (const a of arquivos) fd.append("arquivos", a);
    setEnviando(true);
    try {
      const r = await fetch("/api/ia/levantamentos", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro ?? "Falha ao enviar.");
      router.push(`/ia/${j.id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao enviar.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div>
        <label className="label">Nome do projeto *</label>
        <input name="titulo" required className="input" placeholder="Ex.: App de agendamento — Clínica Vida" disabled={desabilitado} />
      </div>
      <div>
        <label className="label">Cliente</label>
        <input name="cliente" className="input" disabled={desabilitado} />
      </div>
      <div>
        <label className="label">Briefing / observações</label>
        <textarea
          name="observacoes"
          rows={6}
          value={briefing}
          onChange={(e) => setBriefing(e.target.value)}
          className="input"
          disabled={desabilitado}
          placeholder={"Cole aqui a conversa com o cliente ou descreva o que ele pediu.\nEx.: app para pacientes marcarem consulta, pagar com Pix e receber lembrete no WhatsApp. Painel para a recepção. Quer lançar em 60 dias."}
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          if (!desabilitado) adicionar(e.dataTransfer.files);
        }}
        onClick={() => !desabilitado && input.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition",
          arrastando ? "border-neon bg-neon/5" : "border-ink-600 hover:border-ink-500",
          desabilitado && "cursor-not-allowed opacity-50",
        )}
      >
        <FileUp className="mb-2 h-7 w-7 text-ink-400" />
        <div className="text-sm font-medium text-ink-100">Documentos do briefing (opcional)</div>
        <div className="mt-1 text-xs text-ink-400">PDF da proposta ou briefing, prints de telas e referências, textos · até 22 MB</div>
        <input ref={input} type="file" name="arquivos" multiple accept={ACEITOS} className="hidden" onChange={(e) => adicionar(e.target.files)} />
      </div>

      {arquivos.length > 0 && (
        <ul className="space-y-1.5">
          {arquivos.map((a, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-ink-900 px-3 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              <span className="text-xs text-ink-400">{fmtTamanho(a.size)}</span>
              <button type="button" onClick={() => setArquivos((v) => v.filter((_, j) => j !== i))} className="text-ink-400 hover:text-red-300" aria-label="Remover">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          <li className={cn("text-right text-xs", total > LIMITE_TOTAL ? "text-red-300" : "text-ink-500")}>Total: {fmtTamanho(total)}</li>
        </ul>
      )}

      {erro && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{erro}</div>}

      <button className="btn-primario w-full" disabled={desabilitado || enviando || (!arquivos.length && briefing.trim().length < 40) || total > LIMITE_TOTAL}>
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {enviando ? "Enviando briefing..." : "Montar escopo com IA"}
      </button>
    </form>
  );
}

// Enquanto a IA trabalha, recarrega a página a cada poucos segundos.
export function AtualizarEnquantoProcessa() {
  const router = useRouter();
  const [seg, setSeg] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeg((s) => s + 1), 1000);
    const r = setInterval(() => router.refresh(), 5000);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, [router]);
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <div className="relative">
        <Sparkles className="h-10 w-10 text-neon" />
        <Loader2 className="absolute -right-3 -top-3 h-5 w-5 animate-spin text-neon/70" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-white">A IA está montando o escopo…</h2>
      <p className="mt-2 max-w-md text-sm text-ink-400">
        Ela lê o briefing, define módulos e stack, quebra o trabalho em itens com pontos e calibra os prazos pelo histórico da NTECH. Costuma levar de 1 a 4 minutos.
      </p>
      <p className="mt-4 font-mono text-xs text-ink-500">
        {Math.floor(seg / 60)}:{String(seg % 60).padStart(2, "0")}
      </p>
    </div>
  );
}
