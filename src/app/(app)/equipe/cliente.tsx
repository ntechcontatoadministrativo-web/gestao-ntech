"use client";

import { useTransition } from "react";
import { Loader2, Pencil, UserPlus } from "lucide-react";
import { alternarAtivo, criarUsuario, editarUsuario } from "@/actions/equipe";
import { BotaoEnviar, Formulario, Modal } from "@/components/client";

type Dados = { id: string; nome: string; email: string; cargo: string | null; telefone: string | null; perfil: "GESTOR" | "COLABORADOR" };

function gerarSenha() {
  const c = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => c[n % c.length]).join("");
}

function Campos({ usuario, novo }: { usuario?: Dados; novo?: boolean }) {
  return (
    <>
      <div>
        <label className="label">Nome completo</label>
        <input name="nome" defaultValue={usuario?.nome} required className="input" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">E-mail (login)</label>
          <input name="email" type="email" defaultValue={usuario?.email} required className="input" />
        </div>
        <div>
          <label className="label">Cargo</label>
          <input name="cargo" defaultValue={usuario?.cargo ?? ""} className="input" placeholder="Ex.: Projetista elétrico" />
        </div>
      </div>
      <div>
        <label className="label">WhatsApp</label>
        <input name="telefone" type="tel" defaultValue={usuario?.telefone ?? ""} className="input" placeholder="(91) 98888-7777" />
        <p className="mt-1 text-xs text-ink-500">Usado para gerar as mensagens de tarefas e etapas.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Perfil</label>
          <select name="perfil" defaultValue={usuario?.perfil ?? "COLABORADOR"} className="input">
            <option value="COLABORADOR">Colaborador</option>
            <option value="GESTOR">Gestor</option>
          </select>
        </div>
        <div>
          <label className="label">{novo ? "Senha inicial" : "Nova senha (opcional)"}</label>
          <input name="senha" type="text" required={novo} minLength={8} defaultValue={novo ? gerarSenha() : ""} className="input font-mono" autoComplete="off" />
        </div>
      </div>
      {novo && <p className="text-xs text-ink-400">Envie a senha inicial à pessoa; ela pode trocá-la em &quot;Minha conta&quot;.</p>}
    </>
  );
}

export function FormUsuario() {
  return (
    <Modal
      titulo="Nova pessoa"
      gatilho={(abrir) => (
        <button className="btn-primario" onClick={abrir}>
          <UserPlus className="h-4 w-4" /> Adicionar pessoa
        </button>
      )}
    >
      {() => (
        <Formulario acao={criarUsuario} resetar className="space-y-4">
          <Campos novo />
          <div className="flex justify-end">
            <BotaoEnviar>Cadastrar</BotaoEnviar>
          </div>
        </Formulario>
      )}
    </Modal>
  );
}

export function EditarUsuario({ usuario }: { usuario: Dados }) {
  return (
    <Modal
      titulo="Editar pessoa"
      gatilho={(abrir) => (
        <button className="btn-secundario" onClick={abrir}>
          <Pencil className="h-4 w-4" /> Editar
        </button>
      )}
    >
      {() => (
        <Formulario acao={editarUsuario.bind(null, usuario.id)} className="space-y-4">
          <Campos usuario={usuario} />
          <div className="flex justify-end">
            <BotaoEnviar>Salvar</BotaoEnviar>
          </div>
        </Formulario>
      )}
    </Modal>
  );
}

export function BotaoAtivo({ id, ativo }: { id: string; ativo: boolean }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      className={ativo ? "btn-perigo btn-sm" : "btn-secundario btn-sm"}
      disabled={pendente}
      onClick={() => iniciar(() => alternarAtivo(id))}
    >
      {pendente && <Loader2 className="h-3 w-3 animate-spin" />}
      {ativo ? "Desativar" : "Reativar"}
    </button>
  );
}
