"use client";

import { BotaoEnviar, Formulario } from "@/components/client";
import { entrar } from "./actions";

export function FormLogin() {
  return (
    <Formulario acao={entrar} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="voce@ntech.dev.br" />
      </div>
      <div>
        <label className="label" htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required className="input" placeholder="••••••••" />
      </div>
      <BotaoEnviar className="btn-primario w-full py-3" pendente="Entrando...">Entrar</BotaoEnviar>
    </Formulario>
  );
}
