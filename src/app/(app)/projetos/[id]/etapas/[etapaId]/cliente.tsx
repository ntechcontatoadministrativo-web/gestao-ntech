"use client";

import type { StatusEtapa } from "@prisma/client";
import { comentar, definirStatusEtapa } from "@/actions/etapas";
import { BotaoEnviar, Formulario, SelectAuto } from "@/components/client";

export function FormComentario({ etapaId }: { etapaId: string }) {
  return (
    <Formulario acao={comentar.bind(null, etapaId)} resetar aoConcluir={() => {}} className="mt-5 border-t border-ink-800 pt-4">
      <textarea name="texto" rows={3} required maxLength={4000} className="input" placeholder="Escreva um comentário, dúvida ou atualização..." />
      <div className="mt-2 flex justify-end">
        <BotaoEnviar className="btn-primario btn-sm" pendente="Enviando...">
          Comentar
        </BotaoEnviar>
      </div>
    </Formulario>
  );
}

export function StatusManual({ etapaId, status }: { etapaId: string; status: StatusEtapa }) {
  return (
    <form action={definirStatusEtapa.bind(null, etapaId)}>
      <SelectAuto key={status} name="status" defaultValue={status} className="input w-auto py-2 text-xs" aria-label="Alterar status">
        <option value="PENDENTE">Pendente</option>
        <option value="EM_ANDAMENTO">Em andamento</option>
        <option value="AGUARDANDO_APROVACAO">Aguardando aprovação</option>
        <option value="CONCLUIDA">Concluída</option>
      </SelectAuto>
    </form>
  );
}
