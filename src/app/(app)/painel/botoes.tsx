"use client";

import { useTransition } from "react";
import { Check, Loader2, Play, Send, Undo2 } from "lucide-react";
import type { StatusEtapa } from "@prisma/client";
import { aprovarEtapa, devolverEtapa, enviarParaAprovacao, iniciarEtapa } from "@/actions/etapas";
import { BotaoEnviar, Formulario, Modal } from "@/components/client";

export function BotoesFluxo({ etapaId, status }: { etapaId: string; status: StatusEtapa }) {
  const [pendente, iniciar] = useTransition();
  if (status === "PENDENTE")
    return (
      <button className="btn-secundario btn-sm" disabled={pendente} onClick={() => iniciar(() => iniciarEtapa(etapaId))}>
        {pendente ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Iniciar
      </button>
    );
  if (status === "EM_ANDAMENTO")
    return (
      <button className="btn-primario btn-sm" disabled={pendente} onClick={() => iniciar(() => enviarParaAprovacao(etapaId))}>
        {pendente ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Enviar para aprovação
      </button>
    );
  return null;
}

export function BotoesAprovacao({ etapaId }: { etapaId: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Modal
        titulo="Devolver para ajustes"
        gatilho={(abrir) => (
          <button className="btn-secundario btn-sm" onClick={abrir}>
            <Undo2 className="h-3.5 w-3.5" /> Devolver
          </button>
        )}
      >
        {(fechar) => (
          <Formulario acao={devolverEtapa.bind(null, etapaId)} aoConcluir={fechar} className="space-y-4">
            <div>
              <label className="label">O que precisa ser ajustado?</label>
              <textarea name="motivo" rows={4} required className="input" placeholder="Descreva os ajustes para o responsável..." />
            </div>
            <div className="flex justify-end">
              <BotaoEnviar>Devolver etapa</BotaoEnviar>
            </div>
          </Formulario>
        )}
      </Modal>
      <button className="btn-primario btn-sm" disabled={pendente} onClick={() => iniciar(() => aprovarEtapa(etapaId))}>
        {pendente ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Aprovar
      </button>
    </div>
  );
}
