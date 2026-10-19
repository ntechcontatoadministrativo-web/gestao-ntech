import Link from "next/link";
import { Download } from "lucide-react";
import { exigirGestor } from "@/lib/auth";
import { periodoRelatorio, relatorioProdutividade } from "@/lib/relatorios";
import { cn, fmtMinutos } from "@/lib/utils";
import { Avatar, Cabecalho, Kpi, Progresso } from "@/components/ui";

export const metadata = { title: "Relatórios" };

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

// Barra horizontal de magnitude (uma série, uma cor); o valor fica escrito ao lado.
function Barra({ valor, max, rotulo, dica }: { valor: number; max: number; rotulo: string; dica: string }) {
  return (
    <div className="flex items-center gap-3" title={dica}>
      <div className="h-2.5 flex-1 rounded-full bg-ink-800">
        <div className="h-2.5 rounded-full bg-neon/80 transition-all hover:bg-neon" style={{ width: `${max ? Math.max(valor ? 2 : 0, (valor / max) * 100) : 0}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-100">{rotulo}</span>
    </div>
  );
}

export default async function Relatorios({ searchParams }: { searchParams: { periodo?: string; de?: string; ate?: string } }) {
  await exigirGestor();
  const { de, ate, ini, fim } = periodoRelatorio(searchParams);
  const { pessoas, projetos, totais } = await relatorioProdutividade(ini, fim);
  const maxHoras = Math.max(0, ...pessoas.map((p) => p.minutos));
  const maxProj = Math.max(0, ...projetos.map((p) => p.minutos));
  const ativo = !searchParams.de && !searchParams.ate ? (searchParams.periodo ?? "30") : null;
  const fmt = (s: string) => s.split("-").reverse().join("/");

  return (
    <>
      <Cabecalho
        eyebrow="Fase 3 · Relatórios"
        titulo="Produtividade"
        descricao={`De ${fmt(de)} a ${fmt(ate)}. Entregas no prazo = concluídas até o dia do prazo.`}
        acoes={
          <a href={`/api/relatorios/csv?de=${de}&ate=${ate}`} className="btn-secundario">
            <Download className="h-4 w-4" /> Exportar CSV
          </a>
        }
      />

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1.5">
          {["7", "30", "90"].map((p) => (
            <Link
              key={p}
              href={`/relatorios?periodo=${p}`}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", ativo === p ? "bg-neon text-ink-950" : "bg-ink-800 text-ink-300 hover:bg-ink-700")}
            >
              {p} dias
            </Link>
          ))}
        </div>
        <form className="flex items-center gap-2">
          <input type="date" name="de" defaultValue={de} className="input py-2" aria-label="De" />
          <span className="text-ink-500">→</span>
          <input type="date" name="ate" defaultValue={ate} className="input py-2" aria-label="Até" />
          <button className="btn-secundario">Aplicar</button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Horas apontadas" valor={fmtMinutos(totais.minutos)} destaque />
        <Kpi rotulo="Etapas concluídas" valor={totais.etapas} detalhe={`${pct(totais.etapasNoPrazo, totais.etapas)} no prazo`} />
        <Kpi rotulo="Tarefas concluídas" valor={totais.tarefas} detalhe={`${pct(totais.tarefasNoPrazo, totais.tarefas)} no prazo`} />
        <Kpi rotulo="Pessoas ativas" valor={pessoas.length} />
      </div>

      <section className="card mt-6">
        <div className="border-b border-ink-700 px-5 py-4">
          <h2 className="font-semibold text-white">Por pessoa</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Pessoa</th>
                <th className="min-w-[200px]">Horas apontadas</th>
                <th className="text-center">Etapas concluídas</th>
                <th className="text-center">No prazo</th>
                <th className="text-center">Tarefas concluídas</th>
                <th className="text-center">No prazo</th>
                <th className="text-center">Atrasadas em aberto</th>
                <th className="text-center">Arquivos enviados</th>
              </tr>
            </thead>
            <tbody>
              {pessoas.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/equipe/${p.id}`} className="flex items-center gap-2.5 hover:text-neon">
                      <Avatar nome={p.nome} tamanho="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.nome}</span>
                        {p.cargo && <span className="block truncate text-[11px] text-ink-500">{p.cargo}</span>}
                      </span>
                    </Link>
                  </td>
                  <td>
                    <Barra valor={p.minutos} max={maxHoras} rotulo={fmtMinutos(p.minutos)} dica={`${p.nome}: ${fmtMinutos(p.minutos)} no período`} />
                  </td>
                  <td className="text-center tabular-nums">{p.etapasConcluidas}</td>
                  <td className="text-center tabular-nums text-ink-300">{pct(p.etapasNoPrazo, p.etapasConcluidas)}</td>
                  <td className="text-center tabular-nums">{p.tarefasConcluidas}</td>
                  <td className="text-center tabular-nums text-ink-300">{pct(p.tarefasNoPrazo, p.tarefasConcluidas)}</td>
                  <td className="text-center tabular-nums">{p.abertasAtrasadas ? <span className="text-red-300">{p.abertasAtrasadas}</span> : 0}</td>
                  <td className="text-center tabular-nums">{p.envios}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card mt-6">
        <div className="border-b border-ink-700 px-5 py-4">
          <h2 className="font-semibold text-white">Por projeto</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Projeto</th>
                <th className="min-w-[200px]">Horas no período</th>
                <th className="min-w-[140px]">Progresso</th>
                <th className="text-center">Etapas concluídas no período</th>
              </tr>
            </thead>
            <tbody>
              {projetos.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/projetos/${p.id}`} className="hover:text-neon">
                      <span className="mr-2 font-mono text-xs text-ink-400">{p.codigo}</span>
                      {p.nome}
                    </Link>
                  </td>
                  <td>
                    <Barra valor={p.minutos} max={maxProj} rotulo={fmtMinutos(p.minutos)} dica={`${p.codigo}: ${fmtMinutos(p.minutos)} no período`} />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Progresso valor={p.progresso} className="flex-1" />
                      <span className="w-9 text-right text-xs tabular-nums text-ink-300">{p.progresso}%</span>
                    </div>
                  </td>
                  <td className="text-center tabular-nums">{p.etapasConcluidas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
