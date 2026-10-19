"use client";

import { useState } from "react";
import type { ModeloEtapa, TipoProjeto } from "@prisma/client";
import { criarProjeto } from "@/actions/projetos";
import { BotaoEnviar, Formulario } from "@/components/client";
import { cn } from "@/lib/utils";

const TIPOS: { v: TipoProjeto; rotulo: string; texto: string }[] = [
  { v: "SOFTWARE", rotulo: "Software sob medida", texto: "Sistema web, app ou automação para cliente" },
  { v: "SITE", rotulo: "Site / landing page", texto: "Institucional, loja, página de captura" },
  { v: "SUPORTE", rotulo: "Suporte e manutenção", texto: "Contrato contínuo com chamados e SLA" },
  { v: "PRODUTO", rotulo: "Produto próprio", texto: "SaaS da NTECH, com roadmap e versões" },
  { v: "INTERNO", rotulo: "Interno", texto: "Ferramentas e iniciativas da própria empresa" },
];

export function FormNovoProjeto({
  modelos,
  pessoas,
  clientes,
  hoje,
  clienteInicial,
}: {
  modelos: ModeloEtapa[];
  pessoas: { id: string; nome: string }[];
  clientes: { id: string; nome: string }[];
  hoje: string;
  clienteInicial?: string;
}) {
  const [tipo, setTipo] = useState<TipoProjeto>("SOFTWARE");
  const doTipo = modelos.filter((m) => !m.tipo || m.tipo === tipo);
  const [usarModelo, setUsarModelo] = useState(true);
  const [inicio, setInicio] = useState(hoje);

  // Prévia dos prazos sugeridos (mesma regra do servidor).
  let cursor = new Date(`${inicio}T12:00:00`).getTime();
  const previa = doTipo.map((m) => {
    cursor += m.diasPadrao * 86400000;
    return new Date(cursor).toLocaleDateString("pt-BR");
  });

  return (
    <Formulario acao={criarProjeto} className="space-y-6">
      <section className="card p-5">
        <div className="label">Tipo de projeto</div>
        <input type="hidden" name="tipo" value={tipo} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TIPOS.map((t) => (
            <button
              type="button"
              key={t.v}
              onClick={() => setTipo(t.v)}
              className={cn(
                "rounded-xl border px-4 py-3 text-left transition",
                tipo === t.v ? "border-neon/60 bg-neon/[0.06]" : "border-ink-700 bg-ink-900 hover:border-ink-500",
              )}
            >
              <div className={cn("text-sm font-semibold", tipo === t.v ? "text-neon" : "text-ink-100")}>{t.rotulo}</div>
              <div className="mt-0.5 text-xs text-ink-400">{t.texto}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <div>
            <label className="label">Nome do projeto *</label>
            <input name="nome" required className="input" placeholder="Ex.: App de agendamento — Clínica Vida" />
          </div>
          <div>
            <label className="label">Código</label>
            <input name="codigo" className="input font-mono uppercase" placeholder="Automático" />
          </div>
        </div>
        <div>
          <label className="label">Cliente</label>
          <select name="clienteId" defaultValue={clienteInicial ?? ""} className="input">
            <option value="">{tipo === "PRODUTO" || tipo === "INTERNO" ? "NTECH (interno)" : "Sem cliente"}</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          {clientes.length === 0 && <p className="mt-1 text-xs text-ink-400">Cadastre clientes em Clientes para ligar contratos e chamados.</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Repositório</label>
            <input name="repositorio" className="input" placeholder="https://github.com/ntech/..." />
          </div>
          <div>
            <label className="label">Stack</label>
            <input name="stack" className="input" placeholder="Next.js, Postgres, Render" />
          </div>
        </div>
        <div>
          <label className="label">Descrição / escopo</label>
          <textarea name="descricao" rows={3} className="input" placeholder="Problema do cliente, o que será entregue, fora do escopo" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Início</label>
            <input name="dataInicio" type="date" className="input" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <label className="label">Entrega / go-live</label>
            <input name="prazoFinal" type="date" className="input" />
            <p className="mt-1 text-xs text-ink-400">Em branco: usa o prazo da última etapa.</p>
          </div>
        </div>
      </section>

      {doTipo.length > 0 && (
        <section className="card p-5">
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" name="usarModelo" checked={usarModelo} onChange={(e) => setUsarModelo(e.target.checked)} className="h-4 w-4 accent-[#5CFF4F]" />
            <span>
              <span className="block font-medium text-white">Criar com as etapas padrão deste tipo</span>
              <span className="block text-xs text-ink-400">Defina já os responsáveis de cada etapa (opcional). Os modelos ficam em Configurações.</span>
            </span>
          </label>

          {usarModelo && (
            <ol className="mt-4 divide-y divide-ink-800 rounded-xl border border-ink-700">
              {doTipo.map((m, i) => (
                <li key={m.id} className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_200px]">
                  <div>
                    <div className="text-sm font-medium text-ink-100">
                      <span className="mr-2 font-mono text-xs text-neon">{String(i + 1).padStart(2, "0")}</span>
                      {m.nome}
                    </div>
                    <div className="text-xs text-ink-400">
                      {m.diasPadrao} dias · prazo sugerido {previa[i]}
                    </div>
                  </div>
                  <select name={`resp_${m.id}`} className="input py-2" defaultValue="">
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
          )}
        </section>
      )}

      <div className="flex justify-end">
        <BotaoEnviar pendente="Criando...">Criar projeto</BotaoEnviar>
      </div>
    </Formulario>
  );
}
