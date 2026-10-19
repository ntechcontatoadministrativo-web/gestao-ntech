"use client";

import { Ban, Trash2, Users } from "lucide-react";
import type { NivelAcesso } from "@prisma/client";
import { bloquearTodos, definirAcesso, definirAcessoEquipe, excluirArquivo } from "@/actions/arquivos";
import { BotaoConfirmar, SelectAuto } from "@/components/client";
import { Avatar, NivelBadge } from "@/components/ui";

type Pessoa = {
  id: string;
  nome: string;
  online: boolean;
  individual: string | null;
  efetivo: "BAIXAR" | "VISUALIZAR" | null;
};

export function PainelAcesso({
  arquivoId,
  acessoEquipe,
  ehDaEtapa,
  pessoas,
}: {
  arquivoId: string;
  acessoEquipe: NivelAcesso | null;
  ehDaEtapa: boolean;
  pessoas: Pessoa[];
}) {
  return (
    <section className="card">
      <div className="border-b border-ink-700 px-5 py-4">
        <h2 className="font-semibold text-white">Controle de acesso</h2>
        <p className="mt-0.5 text-xs text-ink-400">Mudanças valem na hora, inclusive para quem está com o arquivo aberto.</p>
      </div>

      <div className="border-b border-ink-700 px-5 py-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-100">
          <Users className="h-4 w-4 text-ink-400" />
          {ehDaEtapa ? "Responsável da etapa" : "Equipe do projeto"}
        </div>
        <form action={definirAcessoEquipe.bind(null, arquivoId)}>
          <SelectAuto key={acessoEquipe ?? "x"} name="nivel" defaultValue={acessoEquipe ?? ""} className="input py-2 text-sm">
            <option value="">Sem acesso</option>
            <option value="VISUALIZAR">Só visualizar</option>
            <option value="BAIXAR">Visualizar e baixar</option>
          </SelectAuto>
        </form>
        <p className="mt-1.5 text-[11px] text-ink-500">
          {ehDaEtapa ? "Vale para quem for responsável pela etapa deste arquivo." : "Vale para quem é responsável por alguma etapa do projeto."} Liberações
          individuais abaixo têm prioridade.
        </p>
      </div>

      <ul className="max-h-[52vh] divide-y divide-ink-800 overflow-y-auto">
        {pessoas.length === 0 && <li className="px-5 py-4 text-sm text-ink-500">Nenhum colaborador ativo.</li>}
        {pessoas.map((p) => (
          <li key={p.id} className="px-5 py-3">
            <div className="flex items-center gap-3">
              <Avatar nome={p.nome} online={p.online} tamanho="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink-100">{p.nome}</div>
                <div className="mt-0.5">
                  <NivelBadge nivel={p.individual === "BLOQUEADO" ? "BLOQUEADO" : p.efetivo} />
                </div>
              </div>
            </div>
            <form action={definirAcesso.bind(null, arquivoId, p.id)} className="mt-2">
              <SelectAuto key={p.individual ?? "padrao"} name="nivel" defaultValue={p.individual ?? "PADRAO"} className="input py-1.5 text-xs">
                <option value="PADRAO">Seguir regra da equipe</option>
                <option value="VISUALIZAR">Liberar: só visualizar</option>
                <option value="BAIXAR">Liberar: visualizar e baixar</option>
                <option value="BLOQUEADO">Bloquear</option>
              </SelectAuto>
            </form>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-700 px-5 py-4">
        <BotaoConfirmar acao={() => bloquearTodos(arquivoId)} mensagem="Bloquear para todos?" rotuloConfirmar="Bloquear">
          <Ban className="h-3.5 w-3.5" /> Bloquear para todos
        </BotaoConfirmar>
        <BotaoConfirmar acao={() => excluirArquivo(arquivoId)} mensagem="Excluir todas as revisões?" rotuloConfirmar="Excluir" className="btn-fantasma btn-sm text-red-300">
          <Trash2 className="h-3.5 w-3.5" /> Excluir
        </BotaoConfirmar>
      </div>
    </section>
  );
}
