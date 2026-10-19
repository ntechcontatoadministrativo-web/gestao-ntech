"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, GitPullRequest, Hand, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { Prioridade, StatusTarefa, TipoTarefa } from "@prisma/client";
import { alterarStatusTarefa, criarTarefa, editarTarefa, excluirTarefa, pegarTarefa, registrarAviso } from "@/actions/tarefas";
import { BotaoConfirmar, BotaoEnviar, Formulario, Modal } from "@/components/client";
import { BotaoWhatsapp, PainelWhatsapp } from "@/components/whatsapp";
import type { OpcoesTarefa } from "@/lib/consultas";

export type { OpcoesTarefa };

export type DadosTarefa = {
  id?: string;
  titulo?: string;
  descricao?: string | null;
  prioridade?: Prioridade;
  tipo?: TipoTarefa;
  pontos?: number | null;
  prazo?: string;
  responsavelId?: string | null;
  projetoId?: string | null;
  etapaId?: string | null;
  sprintId?: string | null;
  linkPr?: string | null;
  status?: StatusTarefa;
};

function Campos({ opcoes, t, apiAtiva, gestor, meuId }: { opcoes: OpcoesTarefa; t?: DadosTarefa; apiAtiva?: boolean; gestor: boolean; meuId: string }) {
  const [projetoId, setProjetoId] = useState(t?.projetoId ?? "");
  const projeto = opcoes.projetos.find((p) => p.id === projetoId);
  const etapas = projeto?.etapas ?? [];
  const sprints = projeto?.sprints ?? [];
  const pessoas = gestor ? opcoes.pessoas : opcoes.pessoas.filter((p) => p.id === meuId || p.id === t?.responsavelId);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
        <div>
          <label className="label">Tipo</label>
          <select name="tipo" defaultValue={t?.tipo ?? "TAREFA"} className="input">
            <option value="FEATURE">✨ Feature</option>
            <option value="BUG">🐞 Bug</option>
            <option value="MELHORIA">🔧 Melhoria</option>
            <option value="TAREFA">☑️ Tarefa</option>
            <option value="PESQUISA">🔬 Pesquisa</option>
          </select>
        </div>
        <div>
          <label className="label">Título *</label>
          <input name="titulo" defaultValue={t?.titulo} required maxLength={200} className="input" placeholder="Ex.: Login com Google no app do cliente" />
        </div>
      </div>
      <div>
        <label className="label">Descrição / critérios de aceite</label>
        <textarea
          name="descricao"
          defaultValue={t?.descricao ?? ""}
          rows={4}
          className="input"
          placeholder={"Como usuário, quero... para...\n\nCritérios de aceite:\n- ..."}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label">Responsável</label>
          <select name="responsavelId" defaultValue={t?.responsavelId ?? ""} className="input">
            <option value="">Ninguém (backlog)</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.id === meuId ? " (eu)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Prioridade</label>
          <select name="prioridade" defaultValue={t?.prioridade ?? "MEDIA"} className="input">
            <option value="BAIXA">Baixa</option>
            <option value="MEDIA">Média</option>
            <option value="ALTA">Alta</option>
            <option value="URGENTE">Urgente</option>
          </select>
        </div>
        <div>
          <label className="label">Pontos</label>
          <select name="pontos" defaultValue={t?.pontos ?? ""} className="input">
            <option value="">—</option>
            {[1, 2, 3, 5, 8, 13, 21].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Projeto</label>
          <select name="projetoId" value={projetoId} onChange={(e) => setProjetoId(e.target.value)} className="input">
            <option value="">Sem projeto</option>
            {opcoes.projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} · {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Sprint</label>
          <select name="sprintId" key={`s${projetoId}`} defaultValue={t?.projetoId === projetoId ? (t?.sprintId ?? "") : ""} disabled={!sprints.length} className="input">
            <option value="">{sprints.length ? "Sem sprint" : "Nenhuma sprint aberta"}</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
                {s.status === "ATIVA" ? " (ativa)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Etapa</label>
          <select name="etapaId" key={projetoId} defaultValue={t?.projetoId === projetoId ? (t?.etapaId ?? "") : ""} disabled={!etapas.length} className="input">
            <option value="">—</option>
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>
                {String(e.ordem).padStart(2, "0")} · {e.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Prazo</label>
          <input name="prazo" type="date" defaultValue={t?.prazo} className="input" />
        </div>
        <div>
          <label className="label">Pull request / branch</label>
          <input name="linkPr" type="url" defaultValue={t?.linkPr ?? ""} className="input" placeholder="https://github.com/..." />
        </div>
      </div>
      {apiAtiva && gestor && (
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-200">
          <input type="checkbox" name="enviarAuto" defaultChecked className="h-4 w-4 accent-[#5CFF4F]" />
          Avisar o responsável automaticamente pelo WhatsApp
        </label>
      )}
    </>
  );
}

export function NovaTarefa({
  opcoes,
  rotulo = "Novo item",
  padrao,
  apiAtiva,
  gestor,
  meuId,
  classe = "btn-primario",
}: {
  opcoes: OpcoesTarefa;
  rotulo?: string;
  padrao?: DadosTarefa;
  apiAtiva?: boolean;
  gestor: boolean;
  meuId: string;
  classe?: string;
}) {
  return (
    <Modal
      titulo="Novo item"
      largura="max-w-2xl"
      gatilho={(abrir) => (
        <button className={classe} onClick={abrir}>
          <Plus className="h-4 w-4" /> {rotulo}
        </button>
      )}
    >
      {(fechar) => <FluxoNovaTarefa opcoes={opcoes} padrao={padrao} fechar={fechar} apiAtiva={apiAtiva} gestor={gestor} meuId={meuId} />}
    </Modal>
  );
}

// Depois de criar, se o gestor designou para alguém, mostra a mensagem de WhatsApp pronta no mesmo modal.
function FluxoNovaTarefa({
  opcoes,
  padrao,
  fechar,
  apiAtiva,
  gestor,
  meuId,
}: {
  opcoes: OpcoesTarefa;
  padrao?: DadosTarefa;
  fechar: () => void;
  apiAtiva?: boolean;
  gestor: boolean;
  meuId: string;
}) {
  const [criada, setCriada] = useState<Record<string, string> | null>(null);
  if (criada && !criada.mensagem)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-neon/30 bg-neon/10 px-3 py-2 text-sm text-neon-400">
          <CheckCircle2 className="h-4 w-4" /> Item #{criada.numero} criado.
        </div>
        <div className="flex justify-between border-t border-ink-700 pt-3">
          <button className="btn-fantasma btn-sm" onClick={() => setCriada(null)}>
            Criar outro
          </button>
          <button className="btn-secundario btn-sm" onClick={fechar}>
            Fechar
          </button>
        </div>
      </div>
    );
  if (criada)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-neon/30 bg-neon/10 px-3 py-2 text-sm text-neon-400">
          <CheckCircle2 className="h-4 w-4" />
          {criada.envio === "enviado"
            ? `#${criada.numero} designado e aviso enviado no WhatsApp de ${criada.nome}.`
            : `#${criada.numero} designado para ${criada.nome}. Avise pelo WhatsApp:`}
        </div>
        {criada.envio && criada.envio !== "enviado" && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">Envio automático falhou: {criada.envio}</div>
        )}
        {criada.envio !== "enviado" && (
          <PainelWhatsapp
            mensagem={criada.mensagem}
            telefone={criada.telefone || null}
            nome={criada.nome}
            aoAbrir={() => void registrarAviso(criada.tarefaId)}
            envio={criada.apiAtiva ? { usuarioId: criada.usuarioId, referencia: `tarefa:${criada.tarefaId}` } : null}
          />
        )}
        <div className="flex justify-between border-t border-ink-700 pt-3">
          <button className="btn-fantasma btn-sm" onClick={() => setCriada(null)}>
            Criar outro
          </button>
          <button className="btn-secundario btn-sm" onClick={fechar}>
            Fechar
          </button>
        </div>
      </div>
    );
  return (
    <Formulario acao={criarTarefa} aoConcluir={(e) => e.dados && setCriada(e.dados)} className="space-y-4">
      {padrao?.status && <input type="hidden" name="status" value={padrao.status} />}
      <Campos opcoes={opcoes} t={padrao} apiAtiva={apiAtiva} gestor={gestor} meuId={meuId} />
      <div className="flex justify-end">
        <BotaoEnviar pendente="Salvando...">Criar item</BotaoEnviar>
      </div>
    </Formulario>
  );
}

export function EditarTarefa({ tarefa, opcoes, gestor, meuId }: { tarefa: DadosTarefa & { id: string }; opcoes: OpcoesTarefa; gestor: boolean; meuId: string }) {
  return (
    <Modal
      titulo="Editar item"
      largura="max-w-2xl"
      gatilho={(abrir) => (
        <button className="btn-fantasma btn-sm px-2" onClick={abrir} aria-label="Editar">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    >
      {(fechar) => (
        <Formulario acao={editarTarefa.bind(null, tarefa.id)} aoConcluir={fechar} className="space-y-4">
          <Campos opcoes={opcoes} t={tarefa} gestor={gestor} meuId={meuId} />
          <div className="flex items-center justify-between">
            {gestor ? (
              <BotaoConfirmar acao={() => excluirTarefa(tarefa.id)} mensagem="Excluir item?" rotuloConfirmar="Excluir">
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

export function AcoesTarefaGestor({
  tarefa,
  opcoes,
  whatsapp,
  meuId,
}: {
  tarefa: DadosTarefa & { id: string };
  opcoes: OpcoesTarefa;
  whatsapp: { nome: string; telefone: string | null; mensagem: string; usuarioId: string; apiAtiva: boolean } | null;
  meuId: string;
}) {
  return (
    <>
      {whatsapp && (
        <BotaoWhatsapp
          nome={whatsapp.nome}
          telefone={whatsapp.telefone}
          mensagem={whatsapp.mensagem}
          aoAbrir={() => void registrarAviso(tarefa.id)}
          envio={whatsapp.apiAtiva ? { usuarioId: whatsapp.usuarioId, referencia: `tarefa:${tarefa.id}` } : null}
        />
      )}
      <EditarTarefa tarefa={tarefa} opcoes={opcoes} gestor meuId={meuId} />
    </>
  );
}

export function LinkPr({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-neon" onClick={(e) => e.stopPropagation()}>
      <GitPullRequest className="h-3.5 w-3.5" /> PR
    </a>
  );
}

export function BotaoPegar({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button className="btn-secundario btn-sm" disabled={pendente} onClick={() => iniciar(() => pegarTarefa(id))}>
      {pendente ? <Loader2 className="h-3 w-3 animate-spin" /> : <Hand className="h-3.5 w-3.5" />} Pegar
    </button>
  );
}

// Próximo passo do fluxo: Backlog/A fazer → Fazendo → Em revisão → Feita.
export function StatusTarefaControle({ id, status, gestor }: { id: string; status: StatusTarefa; gestor: boolean }) {
  const [pendente, iniciar] = useTransition();
  const mudar = (s: StatusTarefa) => iniciar(() => alterarStatusTarefa(id, s));
  const spin = pendente && <Loader2 className="h-3 w-3 animate-spin" />;
  if (status === "BACKLOG" || status === "A_FAZER")
    return (
      <button className="btn-secundario btn-sm" disabled={pendente} onClick={() => mudar("FAZENDO")}>
        {spin} Começar
      </button>
    );
  if (status === "FAZENDO")
    return (
      <span className="flex gap-2">
        <button className="btn-secundario btn-sm" disabled={pendente} onClick={() => mudar("REVISAO")}>
          {spin} Enviar p/ revisão
        </button>
        <button className="btn-primario btn-sm" disabled={pendente} onClick={() => mudar("FEITA")}>
          Concluir
        </button>
      </span>
    );
  if (status === "REVISAO")
    return gestor ? (
      <span className="flex gap-2">
        <button className="btn-fantasma btn-sm" disabled={pendente} onClick={() => mudar("FAZENDO")}>
          Devolver
        </button>
        <button className="btn-primario btn-sm" disabled={pendente} onClick={() => mudar("FEITA")}>
          {spin} Aprovar
        </button>
      </span>
    ) : (
      <span className="text-xs font-semibold text-violet-300">Em revisão</span>
    );
  return (
    <span className="flex items-center gap-2">
      <span className={status === "FEITA" ? "text-xs font-semibold text-neon" : "text-xs text-ink-400"}>{status === "FEITA" ? "Feita" : "Cancelada"}</span>
      {(gestor || status === "FEITA") && (
        <button className="btn-fantasma btn-sm" disabled={pendente} onClick={() => mudar("A_FAZER")}>
          Reabrir
        </button>
      )}
      {gestor && status !== "CANCELADA" && (
        <button className="btn-fantasma btn-sm" disabled={pendente} onClick={() => mudar("CANCELADA")}>
          Cancelar
        </button>
      )}
    </span>
  );
}
