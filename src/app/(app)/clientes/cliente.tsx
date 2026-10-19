"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { criarCliente, editarCliente, excluirCliente, excluirContrato, salvarContrato } from "@/actions/clientes";
import { BotaoConfirmar, BotaoEnviar, Formulario, Modal } from "@/components/client";

type DadosCliente = {
  nome?: string;
  razaoSocial?: string | null;
  documento?: string | null;
  contatoNome?: string | null;
  email?: string | null;
  telefone?: string | null;
  site?: string | null;
  observacoes?: string | null;
  ativo?: boolean;
};

function CamposCliente({ c, edicao }: { c?: DadosCliente; edicao?: boolean }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Nome *</label>
          <input name="nome" defaultValue={c?.nome} required className="input" placeholder="Ex.: Clínica Vida" />
        </div>
        <div>
          <label className="label">Razão social</label>
          <input name="razaoSocial" defaultValue={c?.razaoSocial ?? ""} className="input" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">CNPJ / CPF</label>
          <input name="documento" defaultValue={c?.documento ?? ""} className="input font-mono" />
        </div>
        <div>
          <label className="label">Contato</label>
          <input name="contatoNome" defaultValue={c?.contatoNome ?? ""} className="input" placeholder="Quem fala pela empresa" />
        </div>
        <div>
          <label className="label">WhatsApp / telefone</label>
          <input name="telefone" defaultValue={c?.telefone ?? ""} className="input" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">E-mail</label>
          <input name="email" type="email" defaultValue={c?.email ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Site</label>
          <input name="site" defaultValue={c?.site ?? ""} className="input" />
        </div>
      </div>
      <div>
        <label className="label">Observações</label>
        <textarea name="observacoes" defaultValue={c?.observacoes ?? ""} rows={3} className="input" />
      </div>
      {edicao && (
        <label className="flex items-center gap-2 text-sm text-ink-200">
          <input type="checkbox" name="ativo" defaultChecked={c?.ativo ?? true} className="h-4 w-4 accent-[#5CFF4F]" /> Cliente ativo
        </label>
      )}
    </>
  );
}

export function NovoCliente() {
  return (
    <Modal
      titulo="Novo cliente"
      largura="max-w-2xl"
      gatilho={(abrir) => (
        <button className="btn-primario" onClick={abrir}>
          <Plus className="h-4 w-4" /> Novo cliente
        </button>
      )}
    >
      {() => (
        <Formulario acao={criarCliente} className="space-y-4">
          <CamposCliente />
          <div className="flex justify-end">
            <BotaoEnviar>Cadastrar</BotaoEnviar>
          </div>
        </Formulario>
      )}
    </Modal>
  );
}

export function EditarCliente({ id, cliente }: { id: string; cliente: DadosCliente }) {
  return (
    <Modal
      titulo="Editar cliente"
      largura="max-w-2xl"
      gatilho={(abrir) => (
        <button className="btn-secundario" onClick={abrir}>
          <Pencil className="h-4 w-4" /> Editar
        </button>
      )}
    >
      {(fechar) => (
        <Formulario acao={editarCliente.bind(null, id)} aoConcluir={fechar} className="space-y-4">
          <CamposCliente c={cliente} edicao />
          <div className="flex items-center justify-between">
            <BotaoConfirmar acao={() => excluirCliente(id)} mensagem="Excluir o cliente e os contratos dele?" rotuloConfirmar="Excluir">
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </BotaoConfirmar>
            <BotaoEnviar>Salvar</BotaoEnviar>
          </div>
        </Formulario>
      )}
    </Modal>
  );
}

export type DadosContrato = {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  valor: string;
  diaVencimento: number | null;
  horasMes: number | null;
  slaRespostaHoras: number | null;
  slaSolucaoHoras: number | null;
  inicio: string;
  fim: string;
  projetoId: string | null;
  observacoes: string | null;
};

function CamposContrato({ c, projetos }: { c?: DadosContrato; projetos: { id: string; codigo: string; nome: string }[] }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <div>
          <label className="label">Título *</label>
          <input name="titulo" defaultValue={c?.titulo} required className="input" placeholder="Ex.: Manutenção mensal do app" />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select name="tipo" defaultValue={c?.tipo ?? "PROJETO"} className="input">
            <option value="PROJETO">Projeto fechado</option>
            <option value="MENSALIDADE">Mensalidade</option>
            <option value="SUPORTE">Suporte com SLA</option>
            <option value="HORAS">Banco de horas</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Valor (R$)</label>
          <input name="valor" defaultValue={c?.valor ?? ""} className="input font-mono" placeholder="Total ou por mês" inputMode="decimal" />
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={c?.status ?? "ATIVO"} className="input">
            <option value="PROPOSTA">Proposta</option>
            <option value="ATIVO">Ativo</option>
            <option value="ENCERRADO">Encerrado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>
        <div>
          <label className="label">Dia de vencimento</label>
          <input name="diaVencimento" type="number" min={1} max={31} defaultValue={c?.diaVencimento ?? ""} className="input" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Horas/mês incluídas</label>
          <input name="horasMes" type="number" min={1} defaultValue={c?.horasMes ?? ""} className="input" />
        </div>
        <div>
          <label className="label">SLA resposta (h)</label>
          <input name="slaRespostaHoras" type="number" min={1} defaultValue={c?.slaRespostaHoras ?? ""} className="input" placeholder="padrão 8" />
        </div>
        <div>
          <label className="label">SLA solução (h)</label>
          <input name="slaSolucaoHoras" type="number" min={1} defaultValue={c?.slaSolucaoHoras ?? ""} className="input" placeholder="padrão 72" />
        </div>
      </div>
      <p className="-mt-2 text-[11px] text-ink-500">O SLA vale para chamados de prioridade média; urgente e alta ficam proporcionalmente mais curtos.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Início</label>
          <input name="inicio" type="date" defaultValue={c?.inicio} className="input" />
        </div>
        <div>
          <label className="label">Fim</label>
          <input name="fim" type="date" defaultValue={c?.fim} className="input" />
        </div>
        <div>
          <label className="label">Projeto</label>
          <select name="projetoId" defaultValue={c?.projetoId ?? ""} className="input">
            <option value="">—</option>
            {projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} · {p.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Observações</label>
        <textarea name="observacoes" defaultValue={c?.observacoes ?? ""} rows={2} className="input" />
      </div>
    </>
  );
}

export function FormContrato({ clienteId, contrato, projetos }: { clienteId: string; contrato?: DadosContrato; projetos: { id: string; codigo: string; nome: string }[] }) {
  return (
    <Modal
      titulo={contrato ? "Editar contrato" : "Novo contrato"}
      largura="max-w-2xl"
      gatilho={(abrir) =>
        contrato ? (
          <button className="btn-fantasma btn-sm px-2" onClick={abrir} aria-label="Editar contrato">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button className="btn-secundario btn-sm" onClick={abrir}>
            <Plus className="h-3.5 w-3.5" /> Contrato
          </button>
        )
      }
    >
      {(fechar) => (
        <Formulario acao={salvarContrato.bind(null, clienteId, contrato?.id ?? null)} aoConcluir={fechar} className="space-y-4">
          <CamposContrato c={contrato} projetos={projetos} />
          <div className="flex items-center justify-between">
            {contrato ? (
              <BotaoConfirmar acao={() => excluirContrato(contrato.id)} mensagem="Excluir contrato?" rotuloConfirmar="Excluir">
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
