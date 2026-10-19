"use client";

import { useTransition } from "react";
import { Loader2, Pencil, Play, Plus, Square, Trash2 } from "lucide-react";
import type { StatusSprint } from "@prisma/client";
import { alterarStatusSprint, excluirAmbiente, excluirSprint, salvarAmbiente, salvarSprint } from "@/actions/engenharia";
import { BotaoConfirmar, BotaoEnviar, Formulario, Modal } from "@/components/client";

type DadosSprint = { id: string; nome: string; objetivo: string | null; inicio: string; fim: string };

export function FormSprint({ projetoId, sprint, sugestao }: { projetoId: string; sprint?: DadosSprint; sugestao?: { nome: string; inicio: string; fim: string } }) {
  const v = sprint ?? sugestao;
  return (
    <Modal
      titulo={sprint ? "Editar sprint" : "Nova sprint"}
      gatilho={(abrir) =>
        sprint ? (
          <button className="btn-fantasma btn-sm px-2" onClick={abrir} aria-label="Editar sprint">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button className="btn-secundario btn-sm" onClick={abrir}>
            <Plus className="h-3.5 w-3.5" /> Sprint
          </button>
        )
      }
    >
      {(fechar) => (
        <Formulario acao={salvarSprint.bind(null, projetoId, sprint?.id ?? null)} aoConcluir={fechar} className="space-y-4">
          <div>
            <label className="label">Nome *</label>
            <input name="nome" defaultValue={v?.nome} required className="input" />
          </div>
          <div>
            <label className="label">Objetivo da sprint</label>
            <input name="objetivo" defaultValue={sprint?.objetivo ?? ""} className="input" placeholder="Ex.: cliente consegue agendar e pagar pelo app" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Início *</label>
              <input name="inicio" type="date" defaultValue={v?.inicio} required className="input" />
            </div>
            <div>
              <label className="label">Fim *</label>
              <input name="fim" type="date" defaultValue={v?.fim} required className="input" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            {sprint ? (
              <BotaoConfirmar acao={() => excluirSprint(sprint.id)} mensagem="Excluir sprint? Os itens voltam ao backlog." rotuloConfirmar="Excluir">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </BotaoConfirmar>
            ) : (
              <span />
            )}
            <BotaoEnviar>Salvar</BotaoEnviar>
          </div>
        </Formulario>
      )}
    </Modal>
  );
}

export function BotaoStatusSprint({ id, status }: { id: string; status: StatusSprint }) {
  const [pendente, iniciar] = useTransition();
  if (status === "CONCLUIDA") return null;
  const proximo: StatusSprint = status === "PLANEJADA" ? "ATIVA" : "CONCLUIDA";
  return (
    <button
      className={status === "PLANEJADA" ? "btn-secundario btn-sm" : "btn-primario btn-sm"}
      disabled={pendente}
      title={status === "ATIVA" ? "Itens não concluídos voltam para o backlog" : undefined}
      onClick={() => iniciar(() => alterarStatusSprint(id, proximo))}
    >
      {pendente ? <Loader2 className="h-3 w-3 animate-spin" /> : status === "PLANEJADA" ? <Play className="h-3 w-3" /> : <Square className="h-3 w-3" />}
      {status === "PLANEJADA" ? "Iniciar" : "Concluir"}
    </button>
  );
}

type DadosAmbiente = { id: string; nome: string; url: string | null; branch: string | null; hospedagem: string | null; observacoes: string | null };

export function FormAmbiente({ projetoId, ambiente }: { projetoId: string; ambiente?: DadosAmbiente }) {
  return (
    <Modal
      titulo={ambiente ? "Editar ambiente" : "Novo ambiente"}
      gatilho={(abrir) =>
        ambiente ? (
          <button className="btn-fantasma btn-sm px-2" onClick={abrir} aria-label="Editar ambiente">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button className="btn-secundario btn-sm" onClick={abrir}>
            <Plus className="h-3.5 w-3.5" /> Ambiente
          </button>
        )
      }
    >
      {(fechar) => (
        <Formulario acao={salvarAmbiente.bind(null, projetoId, ambiente?.id ?? null)} aoConcluir={fechar} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nome *</label>
              <input name="nome" defaultValue={ambiente?.nome} required className="input" placeholder="Produção, Homologação..." list="nomes-ambiente" />
              <datalist id="nomes-ambiente">
                <option value="Produção" />
                <option value="Homologação" />
                <option value="Desenvolvimento" />
              </datalist>
            </div>
            <div>
              <label className="label">Branch</label>
              <input name="branch" defaultValue={ambiente?.branch ?? ""} className="input font-mono" placeholder="main" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">URL</label>
              <input name="url" defaultValue={ambiente?.url ?? ""} className="input" placeholder="https://app.cliente.com.br" />
            </div>
            <div>
              <label className="label">Hospedagem</label>
              <input name="hospedagem" defaultValue={ambiente?.hospedagem ?? ""} className="input" placeholder="Render, Vercel, AWS, VPS..." />
            </div>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea name="observacoes" defaultValue={ambiente?.observacoes ?? ""} rows={2} className="input" placeholder="Domínio registrado em..., e-mail transacional via..." />
          </div>
          <div className="flex items-center justify-between">
            {ambiente ? (
              <BotaoConfirmar acao={() => excluirAmbiente(ambiente.id)} mensagem="Excluir ambiente?" rotuloConfirmar="Excluir">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </BotaoConfirmar>
            ) : (
              <span />
            )}
            <BotaoEnviar>Salvar</BotaoEnviar>
          </div>
        </Formulario>
      )}
    </Modal>
  );
}
