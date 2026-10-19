"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { apontarHoras } from "@/actions/horas";
import { BotaoEnviar, Formulario, Modal } from "./client";

export type OpcoesHoras = {
  projetos: { id: string; codigo: string; nome: string; etapas: { id: string; nome: string; ordem: number }[] }[];
  tarefas: { id: string; titulo: string; projetoId: string | null }[];
};

export function FormHoras({
  opcoes,
  padrao,
  hoje,
  aoConcluir,
}: {
  opcoes: OpcoesHoras;
  padrao?: { projetoId?: string | null; etapaId?: string | null; tarefaId?: string | null };
  hoje: string;
  aoConcluir?: () => void;
}) {
  const [projetoId, setProjetoId] = useState(padrao?.projetoId ?? "");
  const etapas = opcoes.projetos.find((p) => p.id === projetoId)?.etapas ?? [];
  const tarefas = opcoes.tarefas.filter((t) => !projetoId || t.projetoId === projetoId || !t.projetoId);

  return (
    <Formulario acao={apontarHoras} resetar aoConcluir={aoConcluir} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_120px_140px]">
        <div>
          <label className="label">Projeto *</label>
          <select name="projetoId" value={projetoId} onChange={(e) => setProjetoId(e.target.value)} required className="input">
            <option value="" disabled>
              Escolha...
            </option>
            {opcoes.projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} · {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Horas *</label>
          <input name="horas" required className="input" placeholder="1:30" inputMode="decimal" />
        </div>
        <div>
          <label className="label">Dia</label>
          <input name="data" type="date" defaultValue={hoje} max={hoje} className="input" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Etapa</label>
          <select name="etapaId" key={projetoId} defaultValue={padrao?.projetoId === projetoId ? (padrao?.etapaId ?? "") : ""} className="input" disabled={!etapas.length}>
            <option value="">—</option>
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>
                {String(e.ordem).padStart(2, "0")} · {e.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Tarefa</label>
          <select name="tarefaId" defaultValue={padrao?.tarefaId ?? ""} className="input" disabled={!tarefas.length}>
            <option value="">—</option>
            {tarefas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.titulo}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">O que foi feito</label>
        <input name="descricao" maxLength={1000} className="input" placeholder="Ex.: dimensionamento dos alimentadores do QDG" />
      </div>
      <div className="flex justify-end">
        <BotaoEnviar pendente="Salvando...">Apontar horas</BotaoEnviar>
      </div>
    </Formulario>
  );
}

export function BotaoApontarHoras({
  opcoes,
  padrao,
  hoje,
  className = "btn-secundario btn-sm",
}: {
  opcoes: OpcoesHoras;
  padrao?: { projetoId?: string | null; etapaId?: string | null; tarefaId?: string | null };
  hoje: string;
  className?: string;
}) {
  return (
    <Modal
      titulo="Apontar horas"
      largura="max-w-2xl"
      gatilho={(abrir) => (
        <button type="button" className={className} onClick={abrir}>
          <Clock className="h-3.5 w-3.5" /> Apontar horas
        </button>
      )}
    >
      {(fechar) => <FormHoras opcoes={opcoes} padrao={padrao} hoje={hoje} aoConcluir={fechar} />}
    </Modal>
  );
}
