"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ExternalLink, HardDrive, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { StatusProjeto, TipoProjeto } from "@prisma/client";
import { alterarStatusProjeto, editarProjeto, excluirProjeto, sincronizarDrive, vincularPastaDrive } from "@/actions/projetos";
import { criarEtapa, editarEtapa, excluirEtapa, moverEtapa } from "@/actions/etapas";
import { BotaoConfirmar, BotaoEnviar, Formulario, Modal, SelectAuto, type EstadoForm } from "@/components/client";

type Pessoa = { id: string; nome: string };

export function AcoesProjeto({
  projeto,
  clientes,
}: {
  clientes: { id: string; nome: string }[];
  projeto: {
    id: string;
    nome: string;
    codigo: string;
    tipo: TipoProjeto;
    clienteId: string | null;
    repositorio: string | null;
    stack: string | null;
    descricao: string | null;
    status: StatusProjeto;
    dataInicio: string;
    prazoFinal: string;
  };
}) {
  return (
    <>
      <form action={alterarStatusProjeto.bind(null, projeto.id)}>
        <SelectAuto name="status" defaultValue={projeto.status} className="input w-auto py-2" aria-label="Status do projeto">
          <option value="ATIVO">Ativo</option>
          <option value="PAUSADO">Pausado</option>
          <option value="CONCLUIDO">Concluído</option>
          <option value="CANCELADO">Cancelado</option>
        </SelectAuto>
      </form>
      <Modal
        titulo="Editar projeto"
        gatilho={(abrir) => (
          <button className="btn-secundario" onClick={abrir}>
            <Pencil className="h-4 w-4" /> Editar
          </button>
        )}
      >
        {(fechar) => (
          <Formulario acao={editarProjeto.bind(null, projeto.id)} aoConcluir={fechar} className="space-y-4">
            <input type="hidden" name="status" value={projeto.status} />
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <div>
                <label className="label">Nome</label>
                <input name="nome" defaultValue={projeto.nome} required className="input" />
              </div>
              <div>
                <label className="label">Código</label>
                <input name="codigo" defaultValue={projeto.codigo} required className="input font-mono uppercase" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Cliente</label>
                <select name="clienteId" defaultValue={projeto.clienteId ?? ""} className="input">
                  <option value="">Sem cliente (interno)</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Tipo</label>
                <select name="tipo" defaultValue={projeto.tipo} className="input">
                  <option value="SOFTWARE">Software sob medida</option>
                  <option value="SITE">Site / landing page</option>
                  <option value="SUPORTE">Suporte e manutenção</option>
                  <option value="PRODUTO">Produto próprio</option>
                  <option value="INTERNO">Interno</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Repositório</label>
                <input name="repositorio" defaultValue={projeto.repositorio ?? ""} className="input" placeholder="https://github.com/ntech/..." />
              </div>
              <div>
                <label className="label">Stack</label>
                <input name="stack" defaultValue={projeto.stack ?? ""} className="input" placeholder="Next.js, Postgres, Render" />
              </div>
            </div>
            <div>
              <label className="label">Descrição</label>
              <textarea name="descricao" rows={3} defaultValue={projeto.descricao ?? ""} className="input" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Início</label>
                <input name="dataInicio" type="date" defaultValue={projeto.dataInicio} className="input" />
              </div>
              <div>
                <label className="label">Prazo final</label>
                <input name="prazoFinal" type="date" defaultValue={projeto.prazoFinal} className="input" />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <BotaoConfirmar acao={() => excluirProjeto(projeto.id)} mensagem="Excluir projeto, etapas e registros?" rotuloConfirmar="Excluir">
                <Trash2 className="h-3.5 w-3.5" /> Excluir projeto
              </BotaoConfirmar>
              <BotaoEnviar>Salvar</BotaoEnviar>
            </div>
          </Formulario>
        )}
      </Modal>
    </>
  );
}

function CamposEtapa({ pessoas, etapa }: { pessoas: Pessoa[]; etapa?: { nome: string; descricao: string | null; responsavelId: string | null; prazo: string } }) {
  return (
    <>
      <div>
        <label className="label">Nome da etapa</label>
        <input name="nome" defaultValue={etapa?.nome} required className="input" placeholder="Ex.: Homologação com o cliente" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Responsável</label>
          <select name="responsavelId" defaultValue={etapa?.responsavelId ?? ""} className="input">
            <option value="">Sem responsável</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Prazo</label>
          <input name="prazo" type="date" defaultValue={etapa?.prazo} className="input" />
        </div>
      </div>
      <div>
        <label className="label">Descrição / o que entregar</label>
        <textarea name="descricao" rows={3} defaultValue={etapa?.descricao ?? ""} className="input" />
      </div>
    </>
  );
}

export function NovaEtapa({ projetoId, pessoas }: { projetoId: string; pessoas: Pessoa[] }) {
  return (
    <Modal
      titulo="Nova etapa"
      gatilho={(abrir) => (
        <button className="btn-secundario btn-sm" onClick={abrir}>
          <Plus className="h-3.5 w-3.5" /> Etapa
        </button>
      )}
    >
      {(fechar) => (
        <Formulario acao={criarEtapa.bind(null, projetoId)} aoConcluir={fechar} className="space-y-4">
          <CamposEtapa pessoas={pessoas} />
          <div className="flex justify-end">
            <BotaoEnviar>Adicionar etapa</BotaoEnviar>
          </div>
        </Formulario>
      )}
    </Modal>
  );
}

export function AcoesEtapa({
  etapa,
  pessoas,
  primeira,
  ultima,
}: {
  etapa: { id: string; nome: string; descricao: string | null; responsavelId: string | null; prazo: string };
  pessoas: Pessoa[];
  primeira: boolean;
  ultima: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {pendente && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin text-ink-400" />}
      <button className="btn-fantasma btn-sm px-2" disabled={primeira || pendente} onClick={() => iniciar(() => moverEtapa(etapa.id, "cima"))} aria-label="Mover para cima">
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button className="btn-fantasma btn-sm px-2" disabled={ultima || pendente} onClick={() => iniciar(() => moverEtapa(etapa.id, "baixo"))} aria-label="Mover para baixo">
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      <Modal
        titulo="Editar etapa"
        gatilho={(abrir) => (
          <button className="btn-fantasma btn-sm px-2" onClick={abrir} aria-label="Editar etapa">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      >
        {(fechar) => (
          <Formulario acao={editarEtapa.bind(null, etapa.id)} aoConcluir={fechar} className="space-y-4">
            <CamposEtapa pessoas={pessoas} etapa={etapa} />
            <div className="flex items-center justify-between pt-2">
              <BotaoConfirmar acao={() => excluirEtapa(etapa.id)} mensagem="Excluir etapa?" rotuloConfirmar="Excluir">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </BotaoConfirmar>
              <BotaoEnviar>Salvar</BotaoEnviar>
            </div>
          </Formulario>
        )}
      </Modal>
    </div>
  );
}

export function CartaoDrive({ projetoId, pastaId, modo }: { projetoId: string; pastaId: string | null; modo: "drive" | "local" }) {
  const [resultado, setResultado] = useState<EstadoForm>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-neon" />
        <h2 className="font-semibold text-white">Google Drive</h2>
      </div>
      {modo === "local" ? (
        <p className="mt-2 text-sm text-ink-400">
          Drive não conectado — os arquivos estão sendo guardados no servidor (modo demonstração).{" "}
          <a href="/configuracoes" className="text-neon hover:underline">
            Conectar Drive
          </a>
        </p>
      ) : (
        <>
          {pastaId ? (
            <div className="mt-3 space-y-3">
              <a
                href={`https://drive.google.com/drive/folders/${pastaId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-ink-200 hover:text-neon"
              >
                <ExternalLink className="h-4 w-4" /> Abrir pasta no Drive
              </a>
              <button
                className="btn-secundario btn-sm w-full"
                disabled={pendente}
                onClick={() => iniciar(async () => setResultado(await sincronizarDrive(projetoId)))}
              >
                {pendente ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Importar arquivos novos do Drive
              </button>
              <p className="text-xs text-ink-500">
                Subpastas com o nome de uma etapa (ex.: &quot;02 - Anteprojeto&quot;) são vinculadas a ela.
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-400">A pasta do projeto é criada automaticamente no primeiro envio, ou vincule uma pasta que já existe:</p>
          )}
          <Formulario acao={vincularPastaDrive.bind(null, projetoId)} className="mt-3 space-y-2">
            <input name="pasta" className="input" placeholder="Link da pasta do Drive" />
            <BotaoEnviar className="btn-secundario btn-sm w-full" pendente="Vinculando...">
              {pastaId ? "Trocar pasta vinculada" : "Vincular pasta existente"}
            </BotaoEnviar>
          </Formulario>
        </>
      )}
      {resultado?.ok && <p className="mt-3 text-xs text-neon">{resultado.ok}</p>}
      {resultado?.erro && <p className="mt-3 text-xs text-red-300">{resultado.erro}</p>}
    </section>
  );
}
