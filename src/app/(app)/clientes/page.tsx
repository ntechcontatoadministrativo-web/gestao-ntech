import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { chamadoAberto } from "@/lib/sla";
import { fmtMoeda } from "@/lib/utils";
import { Badge, Cabecalho, Kpi, Vazio } from "@/components/ui";
import { NovoCliente } from "./cliente";

export const metadata = { title: "Clientes" };

export default async function Clientes({ searchParams }: { searchParams: { q?: string; inativos?: string } }) {
  await exigirGestor();
  const q = searchParams.q?.trim();
  const clientes = await db.cliente.findMany({
    where: {
      ...(searchParams.inativos ? {} : { ativo: true }),
      ...(q ? { OR: [{ nome: { contains: q, mode: "insensitive" } }, { razaoSocial: { contains: q, mode: "insensitive" } }, { documento: { contains: q } }] } : {}),
    },
    include: {
      contratos: { select: { tipo: true, status: true, valorCentavos: true } },
      projetos: { where: { status: "ATIVO" }, select: { id: true } },
      chamados: { select: { status: true } },
    },
    orderBy: { nome: "asc" },
  });

  const ativos = (cs: (typeof clientes)[number]["contratos"]) => cs.filter((c) => c.status === "ATIVO");
  const recorrente = (cs: (typeof clientes)[number]["contratos"]) => ativos(cs).filter((c) => c.tipo !== "PROJETO").reduce((s, c) => s + c.valorCentavos, 0);
  const mrr = clientes.reduce((s, c) => s + recorrente(c.contratos), 0);
  const emProjetos = clientes.reduce((s, c) => s + ativos(c.contratos).filter((x) => x.tipo === "PROJETO").reduce((a, x) => a + x.valorCentavos, 0), 0);
  const propostas = clientes.flatMap((c) => c.contratos).filter((c) => c.status === "PROPOSTA");

  return (
    <>
      <Cabecalho eyebrow="Negócio" titulo="Clientes" descricao="Carteira de clientes, contratos e receita recorrente." acoes={<NovoCliente />} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="MRR" valor={fmtMoeda(mrr)} detalhe="mensalidades + suporte ativos" destaque />
        <Kpi rotulo="Projetos fechados" valor={fmtMoeda(emProjetos)} detalhe="contratos de projeto ativos" />
        <Kpi rotulo="Propostas em aberto" valor={propostas.length} detalhe={fmtMoeda(propostas.reduce((s, c) => s + c.valorCentavos, 0))} />
        <Kpi rotulo="Clientes ativos" valor={clientes.filter((c) => c.ativo).length} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form className="relative w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input name="q" defaultValue={q} placeholder="Buscar por nome, razão social ou CNPJ" className="input pl-9" />
        </form>
        <Link href={searchParams.inativos ? "/clientes" : "/clientes?inativos=1"} className="text-xs font-semibold text-ink-400 hover:text-neon">
          {searchParams.inativos ? "Esconder inativos" : "Mostrar inativos"}
        </Link>
      </div>

      {clientes.length === 0 ? (
        <div className="card">
          <Vazio icone={<Building2 className="h-8 w-8" />} titulo="Nenhum cliente" texto="Cadastre os clientes para ligar projetos, contratos e chamados." />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="text-right">Recorrente/mês</th>
                <th className="text-center">Contratos ativos</th>
                <th className="text-center">Projetos ativos</th>
                <th className="text-center">Chamados abertos</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => {
                const abertos = c.chamados.filter(chamadoAberto).length;
                return (
                  <tr key={c.id} className="hover:bg-ink-800/40">
                    <td>
                      <Link href={`/clientes/${c.id}`} className="font-medium text-ink-100 hover:text-neon">
                        {c.nome}
                      </Link>
                      {!c.ativo && <Badge className="ml-2">inativo</Badge>}
                      {c.contatoNome && <div className="text-xs text-ink-400">{c.contatoNome}</div>}
                    </td>
                    <td className="text-right font-mono tabular-nums">{recorrente(c.contratos) ? fmtMoeda(recorrente(c.contratos)) : "—"}</td>
                    <td className="text-center tabular-nums">{ativos(c.contratos).length}</td>
                    <td className="text-center tabular-nums">{c.projetos.length}</td>
                    <td className="text-center tabular-nums">{abertos ? <span className="text-amber-300">{abertos}</span> : "0"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
