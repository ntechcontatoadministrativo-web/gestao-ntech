"use client";

import { useState } from "react";
import { Rocket, Trash2 } from "lucide-react";
import { excluirDeploy, registrarDeploy } from "@/actions/engenharia";
import { BotaoConfirmar, BotaoEnviar, Formulario, Modal } from "@/components/client";

type Projeto = { id: string; codigo: string; nome: string; ambientes: { id: string; nome: string }[] };

export function NovoDeploy({ projetos, projetoId: inicial }: { projetos: Projeto[]; projetoId?: string }) {
  return (
    <Modal
      titulo="Registrar deploy"
      largura="max-w-xl"
      gatilho={(abrir) => (
        <button className={inicial ? "btn-secundario btn-sm" : "btn-primario"} onClick={abrir}>
          <Rocket className="h-4 w-4" /> Registrar deploy
        </button>
      )}
    >
      {(fechar) => <Campos projetos={projetos} inicial={inicial} fechar={fechar} />}
    </Modal>
  );
}

function Campos({ projetos, inicial, fechar }: { projetos: Projeto[]; inicial?: string; fechar: () => void }) {
  const [projetoId, setProjetoId] = useState(inicial ?? "");
  const ambientes = projetos.find((p) => p.id === projetoId)?.ambientes ?? [];
  return (
    <Formulario acao={registrarDeploy} aoConcluir={fechar} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Projeto *</label>
          <select name="projetoId" value={projetoId} onChange={(e) => setProjetoId(e.target.value)} required className="input">
            <option value="" disabled>
              Escolha...
            </option>
            {projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} · {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ambiente</label>
          <select name="ambienteId" key={projetoId} defaultValue={ambientes.find((a) => /produ/i.test(a.nome))?.id ?? ""} className="input" disabled={!ambientes.length}>
            <option value="">{ambientes.length ? "—" : "Cadastre ambientes no projeto"}</option>
            {ambientes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Versão / tag / commit *</label>
          <input name="versao" required className="input font-mono" placeholder="v1.4.0" />
        </div>
        <div>
          <label className="label">Resultado</label>
          <select name="status" defaultValue="SUCESSO" className="input">
            <option value="SUCESSO">Sucesso</option>
            <option value="FALHOU">Falhou</option>
            <option value="REVERTIDO">Revertido (rollback)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">O que mudou (changelog)</label>
        <textarea name="notas" rows={5} className="input font-mono text-[13px]" placeholder={"- feat: login com Google\n- fix: cálculo do frete\n- chore: atualiza dependências"} />
      </div>
      <div className="flex justify-end">
        <BotaoEnviar>Registrar</BotaoEnviar>
      </div>
    </Formulario>
  );
}

export function ExcluirDeploy({ id }: { id: string }) {
  return (
    <BotaoConfirmar acao={() => excluirDeploy(id)} mensagem="Excluir registro?" className="btn-fantasma btn-sm px-2" rotuloConfirmar="Excluir">
      <Trash2 className="h-3.5 w-3.5" />
    </BotaoConfirmar>
  );
}
