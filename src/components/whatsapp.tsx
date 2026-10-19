"use client";

import { useState, useTransition } from "react";
import { Check, CheckCircle2, Copy, Loader2, MessageCircle, Send } from "lucide-react";
import { enviarMensagemWhatsapp } from "@/actions/notificacoes";
import { Modal } from "./client";
import { cn } from "@/lib/utils";

function linkWa(telefone: string | null, texto: string) {
  const d = (telefone ?? "").replace(/\D/g, "");
  const n = d.length === 10 || d.length === 11 ? `55${d}` : d.length >= 12 ? d : "";
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

// Prévia editável da mensagem + botão que abre o WhatsApp (Web ou app) já com o texto.
export function PainelWhatsapp({
  mensagem,
  telefone,
  nome,
  aoAbrir,
  envio,
}: {
  mensagem: string;
  telefone: string | null;
  nome: string;
  aoAbrir?: () => void;
  // Presente quando a API de WhatsApp está configurada: permite enviar sem sair do sistema.
  envio?: { usuarioId: string; referencia?: string } | null;
}) {
  const [texto, setTexto] = useState(mensagem);
  const [copiado, setCopiado] = useState(false);
  const [enviando, iniciar] = useTransition();
  const [resultado, setResultado] = useState<{ ok: boolean; erro?: string } | null>(null);
  return (
    <div className="space-y-3">
      {!telefone && (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-200">
          {nome} não tem WhatsApp cadastrado. O WhatsApp vai abrir para você escolher o contato. Cadastre o número em Equipe.
        </div>
      )}
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={12} className="input font-mono text-[13px] leading-relaxed" />
      {resultado && (
        <div className={resultado.ok ? "rounded-lg border border-neon/30 bg-neon/10 px-3 py-2 text-sm text-neon-400" : "rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"}>
          {resultado.ok ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Mensagem enviada para {nome}.
            </span>
          ) : (
            `Não foi enviada: ${resultado.erro}`
          )}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {envio && telefone && (
          <button
            type="button"
            className="btn-primario"
            disabled={enviando || resultado?.ok}
            onClick={() => iniciar(async () => setResultado(await enviarMensagemWhatsapp(envio.usuarioId, texto, envio.referencia)))}
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar pelo sistema
          </button>
        )}
        <button
          type="button"
          className="btn-secundario"
          onClick={async () => {
            await navigator.clipboard.writeText(texto);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          }}
        >
          {copiado ? <Check className="h-4 w-4 text-neon" /> : <Copy className="h-4 w-4" />}
          {copiado ? "Copiado" : "Copiar texto"}
        </button>
        <a
          href={linkWa(telefone, texto)}
          target="_blank"
          rel="noreferrer"
          onClick={aoAbrir}
          className="btn inline-flex bg-[#25D366] text-[#062d16] hover:bg-[#3be37a]"
        >
          <MessageCircle className="h-4 w-4" /> Abrir no WhatsApp
        </a>
      </div>
    </div>
  );
}

export function BotaoWhatsapp({
  mensagem,
  telefone,
  nome,
  rotulo = "WhatsApp",
  aoAbrir,
  className,
  envio,
}: {
  mensagem: string;
  telefone: string | null;
  nome: string;
  rotulo?: string;
  aoAbrir?: () => void;
  className?: string;
  envio?: { usuarioId: string; referencia?: string } | null;
}) {
  return (
    <Modal
      titulo={`Mensagem para ${nome}`}
      gatilho={(abrir) => (
        <button type="button" onClick={abrir} className={cn("btn-secundario btn-sm text-[#4ee68a]", className)}>
          <MessageCircle className="h-3.5 w-3.5" /> {rotulo}
        </button>
      )}
    >
      {() => <PainelWhatsapp mensagem={mensagem} telefone={telefone} nome={nome} aoAbrir={aoAbrir} envio={envio} />}
    </Modal>
  );
}
