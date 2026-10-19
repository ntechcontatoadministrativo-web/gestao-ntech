import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataParaInput } from "@/lib/utils";
import { Cabecalho } from "@/components/ui";
import { FormNovoProjeto } from "./form";

export const metadata = { title: "Novo projeto" };

export default async function NovoProjeto({ searchParams }: { searchParams: { cliente?: string } }) {
  await exigirGestor();
  const [modelos, pessoas, clientes] = await Promise.all([
    db.modeloEtapa.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" } }),
    db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.cliente.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/projetos" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-100">
        <ArrowLeft className="h-4 w-4" /> Projetos
      </Link>
      <Cabecalho eyebrow="Novo projeto" titulo="Cadastrar projeto" descricao="As etapas padrão do tipo escolhido são criadas com prazos sugeridos; você ajusta depois." />
      <FormNovoProjeto modelos={modelos} pessoas={pessoas} clientes={clientes} hoje={dataParaInput(new Date())} clienteInicial={searchParams.cliente} />
    </div>
  );
}
