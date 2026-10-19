"use client";

import { trocarMinhaSenha } from "@/actions/equipe";
import { BotaoEnviar, Formulario } from "@/components/client";

export function FormSenha() {
  return (
    <Formulario acao={trocarMinhaSenha} resetar className="space-y-4">
      <div>
        <label className="label">Senha atual</label>
        <input name="atual" type="password" required autoComplete="current-password" className="input" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Nova senha</label>
          <input name="nova" type="password" required minLength={8} autoComplete="new-password" className="input" />
        </div>
        <div>
          <label className="label">Confirmar</label>
          <input name="confirmacao" type="password" required minLength={8} autoComplete="new-password" className="input" />
        </div>
      </div>
      <div className="flex justify-end">
        <BotaoEnviar>Alterar senha</BotaoEnviar>
      </div>
    </Formulario>
  );
}
