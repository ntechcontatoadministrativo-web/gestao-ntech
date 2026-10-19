"use client";

import { useState } from "react";
import { criarProjetoDoLevantamento } from "@/actions/ia";
import { BotaoEnviar, Formulario } from "@/components/client";

type EtapaIA = { nome: string; descricao: string; dias: number; entregaveis: string[] };
type ItemIA = { titulo: string; tipo: string; descricao: string; pontos: number; prioridade: string; etapa: string };

const ICONE_TIPO: Record<string, string> = { FEATURE: "✨", MELHORIA: "🔧", TAREFA: "☑️", PESQUISA: "🔬" };

export function FormCriarProjeto({
  id,
  titulo,
  etapas,
  backlog,
  pessoas,
  clientes,
  clienteSugerido,
  hoje,
}: {
  id: string;
  titulo: string;
  etapas: EtapaIA[];
  backlog: ItemIA[];
  pessoas: { id: string; nome: string }[];
  clientes: { id: string; nome: string }[];
  clienteSugerido?: string;
  hoje: string;
}) {
  const [itens, setItens] = useState(backlog.map(() => true));
  const pontos = backlog.reduce((s, b, i) => s + (itens[i] ? b.pontos : 0), 0);
  const [dias, setDias] = useState(etapas.map((e) => Math.max(1, Math.round(e.dias))));
  const [incluir, setIncluir] = useState(etapas.map(() => true));
  const total = dias.reduce((s, d, i) => s + (incluir[i] ? d : 0), 0);

  return (
    <Formulario acao={criarProjetoDoLevantamento.bind(null, id)}>
      <ol className="divide-y divide-ink-800">
        {etapas.map((e, i) => (
          <li key={i} className="grid gap-3 px-5 py-4 md:grid-cols-[auto_1fr_90px_180px] md:items-start">
            <input
              type="checkbox"
              name={`incluir_${i}`}
              checked={incluir[i]}
              onChange={(ev) => setIncluir((v) => v.map((x, j) => (j === i ? ev.target.checked : x)))}
              className="mt-3 h-4 w-4 accent-[#5CFF4F]"
              aria-label="Incluir etapa"
            />
            <div className={incluir[i] ? "" : "opacity-40"}>
              <input name={`nome_${i}`} defaultValue={e.nome} className="input py-2 font-medium" />
              <p className="mt-1.5 text-xs text-ink-400">{e.descricao}</p>
              {e.entregaveis.length > 0 && <p className="mt-1 text-[11px] text-ink-500">Entregáveis: {e.entregaveis.join(" · ")}</p>}
            </div>
            <div>
              <input
                name={`dias_${i}`}
                type="number"
                min={1}
                value={dias[i]}
                onChange={(ev) => setDias((v) => v.map((x, j) => (j === i ? Math.max(1, Number(ev.target.value) || 1) : x)))}
                className="input py-2 text-center"
                aria-label="Dias"
              />
              <span className="mt-1 block text-center text-[11px] text-ink-500">dias</span>
            </div>
            <select name={`resp_${i}`} defaultValue="" className="input py-2">
              <option value="">Sem responsável</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ol>
      {backlog.length > 0 && (
        <div className="border-t border-ink-700">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-2 pt-4">
            <div>
              <h3 className="font-semibold text-white">Backlog inicial</h3>
              <p className="text-xs text-ink-400">
                {itens.filter(Boolean).length} de {backlog.length} itens · {pontos} pontos. Entram no backlog do projeto, sem responsável.
              </p>
            </div>
            <button type="button" className="btn-fantasma btn-sm" onClick={() => setItens((v) => v.map(() => !v.every(Boolean)))}>
              {itens.every(Boolean) ? "Desmarcar todos" : "Marcar todos"}
            </button>
          </div>
          <ul className="max-h-[480px] divide-y divide-ink-800 overflow-y-auto">
            {backlog.map((b, i) => (
              <li key={i} className={itens[i] ? "px-5 py-3" : "px-5 py-3 opacity-40"}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    name={`item_${i}`}
                    checked={itens[i]}
                    onChange={(ev) => setItens((v) => v.map((x, j) => (j === i ? ev.target.checked : x)))}
                    className="mt-1 h-4 w-4 accent-[#5CFF4F]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      <span>{ICONE_TIPO[b.tipo] ?? "•"}</span>
                      <span className="font-medium text-ink-100">{b.titulo}</span>
                      <span className="rounded-full bg-ink-700 px-1.5 font-mono text-[10px] font-bold text-ink-200">{b.pontos}</span>
                      {b.prioridade !== "MEDIA" && <span className="text-[11px] text-amber-300">{b.prioridade.toLowerCase()}</span>}
                      <span className="text-[11px] text-ink-500">{b.etapa}</span>
                    </span>
                    <span className="mt-1 line-clamp-2 block whitespace-pre-line text-xs text-ink-400">{b.descricao}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-4 border-t border-ink-700 px-5 py-4 sm:grid-cols-2">
        <div>
          <label className="label">Cliente</label>
          <select name="clienteId" defaultValue={clienteSugerido ?? ""} className="input">
            <option value="">—</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 border-t border-ink-700 px-5 py-4 sm:grid-cols-[1fr_140px_160px] sm:items-end">
        <div>
          <label className="label">Nome do projeto</label>
          <input name="nome" defaultValue={titulo} className="input" />
        </div>
        <div>
          <label className="label">Código</label>
          <input name="codigo" placeholder="Automático" className="input font-mono uppercase" />
        </div>
        <div>
          <label className="label">Início</label>
          <input name="dataInicio" type="date" defaultValue={hoje} className="input" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-700 px-5 py-4">
        <span className="text-sm text-ink-300">
          Prazo total: <b className="text-white">{total} dias</b>
        </span>
        <BotaoEnviar pendente="Criando projeto...">Criar projeto com etapas e backlog</BotaoEnviar>
      </div>
    </Formulario>
  );
}
