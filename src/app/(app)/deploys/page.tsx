import Link from "next/link";
import { Rocket } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn, fmtDataHora, tempoRelativo } from "@/lib/utils";
import { Badge, Cabecalho, Kpi, Vazio } from "@/components/ui";
import { SelectAuto } from "@/components/client";
import { ExcluirDeploy, NovoDeploy } from "./cliente";

export const metadata = { title: "Deploys" };

const TOM = { SUCESSO: "verde", FALHOU: "vermelho", REVERTIDO: "amarelo" } as const;
const ROTULO = { SUCESSO: "Sucesso", FALHOU: "Falhou", REVERTIDO: "Revertido" } as const;

export default async function Deploys({ searchParams }: { searchParams: { projeto?: string } }) {
  const u = await exigirUsuario();
  const trintaDias = new Date(Date.now() - 30 * 86400000);
  const [deploys, projetos, ultimos30] = await Promise.all([
    db.deploy.findMany({
      where: searchParams.projeto ? { projetoId: searchParams.projeto } : {},
      include: { projeto: { select: { id: true, codigo: true, nome: true } }, ambiente: { select: { nome: true, url: true } }, autor: { select: { nome: true } } },
      orderBy: { criadoEm: "desc" },
      take: 100,
    }),
    db.projeto.findMany({
      where: { status: { in: ["ATIVO", "PAUSADO"] } },
      select: { id: true, codigo: true, nome: true, ambientes: { select: { id: true, nome: true }, orderBy: { criadoEm: "asc" } } },
      orderBy: { codigo: "desc" },
    }),
    db.deploy.findMany({ where: { criadoEm: { gte: trintaDias } }, select: { status: true, ambiente: { select: { nome: true } } } }),
  ]);
  const falhas = ultimos30.filter((d) => d.status !== "SUCESSO").length;
  const producao = ultimos30.filter((d) => /produ/i.test(d.ambiente?.nome ?? "")).length;

  return (
    <>
      <Cabecalho eyebrow="Engenharia" titulo="Deploys" descricao="Histórico de versões publicadas em cada ambiente, com changelog." acoes={<NovoDeploy projetos={projetos} />} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Deploys (30d)" valor={ultimos30.length} />
        <Kpi rotulo="Em produção (30d)" valor={producao} destaque={producao > 0} />
        <Kpi rotulo="Taxa de falha" valor={ultimos30.length ? `${Math.round((falhas / ultimos30.length) * 100)}%` : "—"} detalhe={`${falhas} falha(s) ou rollback(s)`} />
        <Kpi rotulo="Por semana" valor={(ultimos30.length / 4.3).toFixed(1)} detalhe="frequência média" />
      </div>

      <form className="mb-4">
        <SelectAuto name="projeto" defaultValue={searchParams.projeto ?? ""} className="input w-auto py-2">
          <option value="">Todos os projetos</option>
          {projetos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.codigo} · {p.nome}
            </option>
          ))}
        </SelectAuto>
      </form>

      {deploys.length === 0 ? (
        <div className="card">
          <Vazio icone={<Rocket className="h-8 w-8" />} titulo="Nenhum deploy registrado" texto="Registre cada publicação para ter o histórico do que foi para o ar e quando." />
        </div>
      ) : (
        <ol className="relative space-y-3 border-l border-ink-700 pl-6">
          {deploys.map((d) => (
            <li key={d.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[31px] top-5 h-3 w-3 rounded-full ring-4 ring-ink-950",
                  d.status === "SUCESSO" ? "bg-neon" : d.status === "FALHOU" ? "bg-red-400" : "bg-amber-300",
                )}
              />
              <div className="card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-white">{d.versao}</span>
                  <Link href={`/projetos/${d.projeto.id}`} className="font-mono text-xs text-ink-400 hover:text-neon">
                    {d.projeto.codigo}
                  </Link>
                  <span className="text-sm text-ink-300">{d.projeto.nome}</span>
                  {d.ambiente && (
                    <Badge tom={/produ/i.test(d.ambiente.nome) ? "azul" : "neutro"}>
                      {d.ambiente.url ? (
                        <a href={d.ambiente.url} target="_blank" rel="noreferrer" className="hover:underline">
                          {d.ambiente.nome}
                        </a>
                      ) : (
                        d.ambiente.nome
                      )}
                    </Badge>
                  )}
                  <Badge tom={TOM[d.status]}>{ROTULO[d.status]}</Badge>
                  <span className="ml-auto flex items-center gap-2 text-xs text-ink-400" title={fmtDataHora(d.criadoEm)}>
                    {d.autor?.nome.split(" ")[0]} · {tempoRelativo(d.criadoEm)}
                    {u.perfil === "GESTOR" && <ExcluirDeploy id={d.id} />}
                  </span>
                </div>
                {d.notas && <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-ink-900 px-3 py-2 font-mono text-xs leading-relaxed text-ink-300">{d.notas}</pre>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
