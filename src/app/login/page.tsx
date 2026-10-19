import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { FormLogin } from "./form";

export const metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await usuarioAtual()) redirect("/painel");
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-ink-950 p-12 lg:flex">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-neon/10 blur-3xl" />
        <Logo />
        <div className="relative">
          <div className="mb-4 font-mono text-xs text-neon">$ ntech --hub interno</div>
          <h1 className="text-5xl font-extrabold uppercase leading-[1.02] tracking-tight text-white">
            Código, clientes
            <br />
            e entregas
            <br />
            <span className="text-neon">no mesmo lugar.</span>
          </h1>
          <div className="mt-8 h-1.5 w-24 rounded-full bg-neon" />
          <p className="mt-8 max-w-md text-ink-300">
            Quadro e sprints, chamados com SLA, deploys, contratos e o cofre de acessos da NTECH. Uso exclusivo da equipe.
          </p>
        </div>
        <div className="flex justify-between text-xs text-ink-500">
          <span>ntech.dev.br</span>
          <span>@ntech.bel</span>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-bold text-white">Entrar</h2>
          <p className="mb-8 mt-1 text-sm text-ink-400">Acesso restrito à equipe NTECH. Use o login individual fornecido pelo gestor.</p>
          <FormLogin />
        </div>
      </section>
    </div>
  );
}
