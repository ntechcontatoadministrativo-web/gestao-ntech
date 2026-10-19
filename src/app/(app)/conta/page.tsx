import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { Avatar, Cabecalho } from "@/components/ui";
import { FormSenha } from "./form";

export const metadata = { title: "Minha conta" };

export default async function Conta() {
  const u = await exigirUsuario();
  const missao = (await db.usuario.findUnique({ where: { id: u.id }, select: { missao: true } }))?.missao;
  return (
    <div className="mx-auto max-w-xl">
      <Cabecalho eyebrow="Minha conta" titulo="Minha conta" />
      <section className="card mb-6 flex items-center gap-4 p-5">
        <Avatar nome={u.nome} tamanho="lg" />
        <div>
          <div className="font-semibold text-white">{u.nome}</div>
          <div className="text-sm text-ink-400">
            {u.email} · {u.perfil === "GESTOR" ? "Gestor" : "Colaborador"}
            {u.cargo && ` · ${u.cargo}`}
          </div>
        </div>
      </section>
      {missao && (
        <section className="card mb-6 p-5">
          <div className="eyebrow mb-2">Minha missão</div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-100">{missao}</p>
        </section>
      )}
      <section className="card p-5">
        <h2 className="mb-4 font-semibold text-white">Trocar senha</h2>
        <FormSenha />
      </section>
    </div>
  );
}
