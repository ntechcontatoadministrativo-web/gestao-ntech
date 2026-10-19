"use client";

import { useTransition } from "react";
import { KanbanSquare, Loader2, Pencil, Plus } from "lucide-react";
import type { StatusChamado } from "@prisma/client";
import { alterarStatusChamado, criarChamado, criarTarefaDoChamado, editarChamado, responderChamado } from "@/actions/chamados";
import { BotaoEnviar, Formulario, Modal } from "@/components/client";

export type OpcoesChamado = {
  pessoas: { id: string; nome: string }[];
  clientes: { id: string; nome: string }[];
  projetos: { id: string; codigo: string; nome: string; clienteId: string | null }[];
};

type DadosChamado = {
  titulo?: string;
  descricao?: string | null;
  solicitante?: string | null;
  prioridade?: string;
  canal?: string;
  clienteId?: string | null;
  projetoId?: string | null;
  responsavelId?: string | null;
};

function Campos({ opcoes, c, novo }: { opcoes: OpcoesChamado; c?: DadosChamado; novo?: boolean }) {
  return (
    <>
      <div>
        <label className="label">Assunto *</label>
        <input name="titulo" defaultValue={c?.titulo} required maxLength={200} className="input" placeholder="Ex.: App não envia notificação de pedido" />
      </div>
      <div>
        <label className="label">Descrição</label>
        <textarea name="descricao" defaultValue={c?.descricao ?? ""} rows={4} className="input" placeholder="O que acontece, desde quando, passos para reproduzir, prints..." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Cliente</label>
          <select name="clienteId" defaultValue={c?.clienteId ?? ""} className="input">
            <option value="">—</option>
            {opcoes.clientes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Projeto / sistema</label>
          <select name="projetoId" defaultValue={c?.projetoId ?? ""} className="input">
            <option value="">—</option>
            {opcoes.projetos.map((x) => (
              <option key={x.id} value={x.id}>
                {x.codigo} · {x.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="label">Prioridade</label>
          <select name="prioridade" defaultValue={c?.prioridade ?? "MEDIA"} className="input">
            <option value="BAIXA">Baixa</option>
            <option value="MEDIA">Média</option>
            <option value="ALTA">Alta</option>
            <option value="URGENTE">Urgente (sistema parado)</option>
          </select>
        </div>
        {novo && (
          <div>
            <label className="label">Canal</label>
            <select name="canal" defaultValue={c?.canal ?? "whatsapp"} className="input">
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-mail</option>
              <option value="telefone">Telefone</option>
              <option value="interno">Interno</option>
            </select>
          </div>
        )}
        <div>
          <label className="label">Solicitante</label>
          <input name="solicitante" defaultValue={c?.solicitante ?? ""} className="input" placeholder="Quem pediu" />
        </div>
        <div className={novo ? "" : "sm:col-span-2"}>
          <label className="label">Responsável</label>
          <select name="responsavelId" defaultValue={c?.responsavelId ?? ""} className="input">
            <option value="">Fila (sem responsável)</option>
            {opcoes.pessoas.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}

export function NovoChamado({ opcoes, padrao }: { opcoes: OpcoesChamado; padrao?: DadosChamado }) {
  return (
    <Modal
      titulo="Abrir chamado"
      largura="max-w-2xl"
      gatilho={(abrir) => (
        <button className="btn-primario" onClick={abrir}>
          <Plus className="h-4 w-4" /> Abrir chamado
        </button>
      )}
    >
      {() => (
        <Formulario acao={criarChamado} className="space-y-4">
          <Campos opcoes={opcoes} c={padrao} novo />
          <p className="text-[11px] text-ink-500">O prazo de resposta e solução (SLA) é calculado pela prioridade e pelo contrato do cliente.</p>
          <div className="flex justify-end">
            <BotaoEnviar pendente="Abrindo...">Abrir chamado</BotaoEnviar>
          </div>
        </Formulario>
      )}
    </Modal>
  );
}

export function EditarChamado({ id, opcoes, chamado }: { id: string; opcoes: OpcoesChamado; chamado: DadosChamado }) {
  return (
    <Modal
      titulo="Editar chamado"
      largura="max-w-2xl"
      gatilho={(abrir) => (
        <button className="btn-secundario" onClick={abrir}>
          <Pencil className="h-4 w-4" /> Editar
        </button>
      )}
    >
      {(fechar) => (
        <Formulario acao={editarChamado.bind(null, id)} aoConcluir={fechar} className="space-y-4">
          <Campos opcoes={opcoes} c={chamado} />
          <div className="flex justify-end">
            <BotaoEnviar>Salvar</BotaoEnviar>
          </div>
        </Formulario>
      )}
    </Modal>
  );
}

const PROXIMOS: Record<StatusChamado, { status: StatusChamado; rotulo: string; primario?: boolean }[]> = {
  ABERTO: [{ status: "EM_ATENDIMENTO", rotulo: "Assumir", primario: true }],
  EM_ATENDIMENTO: [
    { status: "AGUARDANDO_CLIENTE", rotulo: "Aguardar cliente" },
    { status: "RESOLVIDO", rotulo: "Resolver", primario: true },
  ],
  AGUARDANDO_CLIENTE: [
    { status: "EM_ATENDIMENTO", rotulo: "Retomar" },
    { status: "RESOLVIDO", rotulo: "Resolver", primario: true },
  ],
  RESOLVIDO: [
    { status: "EM_ATENDIMENTO", rotulo: "Reabrir" },
    { status: "FECHADO", rotulo: "Fechar" },
  ],
  FECHADO: [{ status: "EM_ATENDIMENTO", rotulo: "Reabrir" }],
};

export function BotoesChamado({ id, status, temTarefa }: { id: string; status: StatusChamado; temTarefa: boolean }) {
  const [pendente, iniciar] = useTransition();
  return (
    <span className="flex flex-wrap gap-2">
      {!temTarefa && status !== "FECHADO" && (
        <button className="btn-secundario" disabled={pendente} onClick={() => iniciar(() => criarTarefaDoChamado(id))}>
          <KanbanSquare className="h-4 w-4" /> Criar item no quadro
        </button>
      )}
      {PROXIMOS[status].map((p) => (
        <button key={p.status} className={p.primario ? "btn-primario" : "btn-secundario"} disabled={pendente} onClick={() => iniciar(() => alterarStatusChamado(id, p.status))}>
          {pendente && p.primario && <Loader2 className="h-4 w-4 animate-spin" />} {p.rotulo}
        </button>
      ))}
    </span>
  );
}

export function FormResposta({ id, status }: { id: string; status: StatusChamado }) {
  return (
    <Formulario acao={responderChamado.bind(null, id)} resetar className="space-y-3">
      <textarea name="texto" rows={4} required className="input" placeholder="Resposta enviada ao cliente, diagnóstico, solução aplicada..." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-300">
            <input type="checkbox" name="interna" className="h-4 w-4 accent-[#5CFF4F]" /> Nota interna
          </label>
          <select name="status" defaultValue="" className="input w-auto py-1.5 text-xs">
            <option value="">Manter status</option>
            {status !== "AGUARDANDO_CLIENTE" && <option value="AGUARDANDO_CLIENTE">→ Aguardando cliente</option>}
            {status !== "RESOLVIDO" && <option value="RESOLVIDO">→ Resolvido</option>}
            {status !== "EM_ATENDIMENTO" && <option value="EM_ATENDIMENTO">→ Em atendimento</option>}
          </select>
        </div>
        <BotaoEnviar pendente="Enviando...">Registrar</BotaoEnviar>
      </div>
    </Formulario>
  );
}
