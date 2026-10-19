"use client";

import { useRef, useState } from "react";
import { MessageCircle, RotateCcw, Target } from "lucide-react";
import { salvarMissaoEModelo } from "@/actions/equipe";
import { BotaoEnviar, Formulario } from "@/components/client";
import { aplicarModelo, CAMPOS_MODELO, MODELO_PADRAO } from "@/lib/whatsapp";

export function FormMissaoEModelo({
  id,
  nome,
  missao,
  modelo,
  gestor,
}: {
  id: string;
  nome: string;
  gestor: string;
  missao: string | null;
  modelo: string | null;
}) {
  const [textoMissao, setTextoMissao] = useState(missao ?? "");
  const [texto, setTexto] = useState(modelo ?? "");
  const [exemplo, setExemplo] = useState<"tarefa" | "etapa">("tarefa");
  const area = useRef<HTMLTextAreaElement>(null);

  // Insere {campo} na posição do cursor.
  const inserir = (chave: string) => {
    const el = area.current;
    const base = texto || MODELO_PADRAO;
    const ini = el?.selectionStart ?? base.length;
    const fim = el?.selectionEnd ?? base.length;
    const novo = base.slice(0, ini) + `{${chave}}` + base.slice(fim);
    setTexto(novo);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(ini + chave.length + 2, ini + chave.length + 2);
    });
  };

  const primeiro = nome.split(" ")[0];
  const previa = aplicarModelo(texto.trim() || MODELO_PADRAO, {
    primeiro_nome: primeiro,
    nome,
    tipo: exemplo,
    assunto: exemplo === "tarefa" ? "Corrigir envio de notificação push" : "Desenvolvimento",
    projeto: "P2026-014 · App Clínica Vida",
    etapa: exemplo === "tarefa" ? "Desenvolvimento" : null,
    cliente: "Clínica Vida",
    prazo: "24/10/2026",
    prioridade: exemplo === "tarefa" ? "Alta" : null,
    detalhes: "Reproduzir no Android 14, corrigir e abrir PR para revisão.",
    missao: textoMissao.trim() || null,
    gestor: gestor.split(" ")[0],
    link: "https://gestao…/tarefas?t=…",
  });

  return (
    <Formulario acao={salvarMissaoEModelo.bind(null, id)} className="space-y-6">
      <div>
        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
          <Target className="h-4 w-4 text-neon" /> Missão de {primeiro}
        </label>
        <textarea
          name="missao"
          rows={5}
          value={textoMissao}
          onChange={(e) => setTextoMissao(e.target.value)}
          className="input"
          maxLength={4000}
          placeholder={`Ex.: Responsável pelos projetos executivos de baixa tensão e pela compatibilização com arquitetura. Garante que os quadros de carga e memoriais saiam revisados antes da entrega ao cliente.`}
        />
        <p className="mt-1 text-xs text-ink-500">Aparece no painel e no perfil de {primeiro}. Também pode entrar na mensagem com o campo {"{missao}"}.</p>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-white">
            <MessageCircle className="h-4 w-4 text-[#4ee68a]" /> Mensagem de WhatsApp para {primeiro}
          </label>
          <button type="button" className="btn-fantasma btn-sm" onClick={() => setTexto("")} title="Volta ao modelo padrão do sistema">
            <RotateCcw className="h-3.5 w-3.5" /> Usar padrão
          </button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <textarea
              ref={area}
              name="modeloWhatsapp"
              rows={16}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onFocus={() => !texto && setTexto(MODELO_PADRAO)}
              className="input font-mono text-[13px] leading-relaxed"
              maxLength={4000}
              placeholder={MODELO_PADRAO}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CAMPOS_MODELO.map((c) => (
                <button
                  key={c.chave}
                  type="button"
                  title={c.descricao}
                  onClick={() => inserir(c.chave)}
                  className="rounded-md bg-ink-800 px-2 py-1 font-mono text-[11px] text-ink-200 ring-1 ring-ink-600 hover:bg-ink-700 hover:text-neon"
                >
                  {`{${c.chave}}`}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-500">
              Clique num campo para inserir. Linhas com um campo vazio somem sozinhas (ex.: a linha do prazo some se a tarefa não tiver prazo). Vazio = modelo padrão.
            </p>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-1 text-xs">
              <span className="mr-1 text-ink-400">Prévia de</span>
              {(["tarefa", "etapa"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setExemplo(t)}
                  className={exemplo === t ? "rounded-md bg-neon px-2 py-0.5 font-semibold text-ink-950" : "rounded-md bg-ink-800 px-2 py-0.5 text-ink-300"}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="rounded-2xl bg-[#0b141a] p-4">
              <div className="ml-auto max-w-[92%] whitespace-pre-wrap break-words rounded-xl rounded-tr-sm bg-[#005c4b] px-3 py-2 text-[13px] leading-relaxed text-[#e9edef] shadow">
                {previa.split(/(\*[^*\n]+\*)/g).map((parte, i) =>
                  /^\*[^*]+\*$/.test(parte) ? <strong key={i}>{parte.slice(1, -1)}</strong> : <span key={i}>{parte}</span>,
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <BotaoEnviar>Salvar missão e mensagem</BotaoEnviar>
      </div>
    </Formulario>
  );
}
