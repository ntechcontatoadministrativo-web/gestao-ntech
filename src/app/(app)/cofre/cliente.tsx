"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { excluirCredencial, revelarCredencial, salvarCredencial } from "@/actions/engenharia";
import { BotaoConfirmar, BotaoEnviar, Formulario, Modal } from "@/components/client";

type Projeto = { id: string; codigo: string; nome: string };
type DadosCredencial = { id: string; nome: string; projetoId: string | null; url: string | null; usuario: string | null; observacoes: string | null };

export function FormCredencial({ projetos, credencial }: { projetos: Projeto[]; credencial?: DadosCredencial }) {
  return (
    <Modal
      titulo={credencial ? "Editar credencial" : "Nova credencial"}
      largura="max-w-xl"
      gatilho={(abrir) =>
        credencial ? (
          <button className="btn-fantasma btn-sm px-2" onClick={abrir} aria-label="Editar">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button className="btn-primario" onClick={abrir}>
            <Plus className="h-4 w-4" /> Nova credencial
          </button>
        )
      }
    >
      {(fechar) => (
        <Formulario acao={salvarCredencial.bind(null, credencial?.id ?? null)} aoConcluir={fechar} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nome *</label>
              <input name="nome" defaultValue={credencial?.nome} required className="input" placeholder="Ex.: Painel Hostinger — Clínica Vida" />
            </div>
            <div>
              <label className="label">Projeto</label>
              <select name="projetoId" defaultValue={credencial?.projetoId ?? ""} className="input">
                <option value="">Geral da empresa</option>
                {projetos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} · {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">URL</label>
              <input name="url" defaultValue={credencial?.url ?? ""} className="input" placeholder="https://..." />
            </div>
            <div>
              <label className="label">Usuário / e-mail</label>
              <input name="usuario" defaultValue={credencial?.usuario ?? ""} className="input font-mono" autoComplete="off" />
            </div>
          </div>
          <div>
            <label className="label">{credencial ? "Nova senha / chave (em branco mantém a atual)" : "Senha / chave *"}</label>
            <textarea name="segredo" rows={2} required={!credencial} className="input font-mono" autoComplete="off" spellCheck={false} />
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea name="observacoes" defaultValue={credencial?.observacoes ?? ""} rows={2} className="input" placeholder="2FA no celular da empresa, renovar em março..." />
          </div>
          <div className="flex items-center justify-between">
            {credencial ? (
              <BotaoConfirmar acao={() => excluirCredencial(credencial.id)} mensagem="Excluir credencial?" rotuloConfirmar="Excluir">
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

// Busca o segredo só quando pedido (fica registrado na auditoria) e esconde de novo depois de 30 s.
export function Segredo({ id }: { id: string }) {
  const [valor, setValor] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (!valor) return;
    const t = setTimeout(() => setValor(null), 30_000);
    return () => clearTimeout(t);
  }, [valor]);

  const buscar = async () => {
    setCarregando(true);
    try {
      const v = await revelarCredencial(id);
      setValor(v);
      return v;
    } finally {
      setCarregando(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <code className="max-w-[220px] truncate rounded bg-ink-900 px-2 py-1 font-mono text-xs text-ink-200">{valor ?? "••••••••••"}</code>
      <button className="btn-fantasma btn-sm px-2" disabled={carregando} onClick={() => (valor ? setValor(null) : void buscar())} aria-label={valor ? "Esconder" : "Revelar"}>
        {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : valor ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button
        className="btn-fantasma btn-sm px-2"
        disabled={carregando}
        aria-label="Copiar"
        onClick={async () => {
          const v = valor ?? (await buscar());
          await navigator.clipboard.writeText(v);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        }}
      >
        {copiado ? <Check className="h-3.5 w-3.5 text-neon" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
