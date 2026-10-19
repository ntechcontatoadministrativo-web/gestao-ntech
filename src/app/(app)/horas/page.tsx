import Link from "next/link";
import { Clock, Trash2 } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { opcoesHoras } from "@/lib/consultas";
import { cn, diaBelem, fmtData, fmtMinutos, intervaloDia } from "@/lib/utils";
import { Avatar, Cabecalho, Kpi, Vazio } from "@/components/ui";
import { FormHoras } from "@/components/apontar-horas";
import { BotaoConfirmar } from "@/components/client";
import { excluirApontamento } from "@/actions/horas";

export const metadata = { title: "Horas" };

const PERIODOS = [
  { v: "7", rotulo: "7 dias" },
  { v: "30", rotulo: "30 dias" },
  { v: "90", rotulo: "90 dias" },
] as const;

export default async function Horas({ searchParams }: { searchParams: { periodo?: string; pessoa?: string } }) {
  const u = await exigirUsuario();
  const gestor = u.perfil === "GESTOR";
  const dias = PERIODOS.some((p) => p.v === searchParams.periodo) ? Number(searchParams.periodo) : 7;
  const hoje = diaBelem();
  const [, fimHoje] = intervaloDia(hoje);
  const inicio = new Date(fimHoje.getTime() - dias * 86400000);

  const where: Prisma.ApontamentoWhereInput = {
    data: { gte: inicio, lt: fimHoje },
    ...(gestor ? (searchParams.pessoa ? { usuarioId: searchParams.pessoa } : {}) : { usuarioId: u.id }),
  };
  const [lista, opcoes, pessoas] = await Promise.all([
    db.apontamento.findMany({
      where,
      include: {
        usuario: { select: { id: true, nome: true } },
        projeto: { select: { id: true, codigo: true, nome: true } },
        etapa: { select: { nome: true } },
        tarefa: { select: { titulo: true } },
      },
      orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
      take: 500,
    }),
    opcoesHoras(u),
    gestor ? db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : Promise.resolve([]),
  ]);

  const total = lista.reduce((s, a) => s + a.minutos, 0);
  const hojeMin = lista.filter((a) => diaBelem(a.data) === hoje).reduce((s, a) => s + a.minutos, 0);

  const porProjeto = new Map<string, { rotulo: string; id: string; min: number }>();
  const porPessoa = new Map<string, { nome: string; min: number }>();
  for (const a of lista) {
    const p = porProjeto.get(a.projetoId) ?? { rotulo: `${a.projeto.codigo} · ${a.projeto.nome}`, id: a.projeto.id, min: 0 };
    p.min += a.minutos;
    porProjeto.set(a.projetoId, p);
    const q = porPessoa.get(a.usuarioId) ?? { nome: a.usuario.nome, min: 0 };
    q.min += a.minutos;
    porPessoa.set(a.usuarioId, q);
  }
  const projetosOrd = Array.from(porProjeto.values()).sort((a, b) => b.min - a.min);
  const pessoasOrd = Array.from(porPessoa.values()).sort((a, b) => b.min - a.min);
  const maxProj = Math.max(1, ...projetosOrd.map((p) => p.min));

  // Agrupa por dia para a lista
  const porDia = new Map<string, typeof lista>();
  for (const a of lista) {
    const d = diaBelem(a.data);
    porDia.set(d, [...(porDia.get(d) ?? []), a]);
  }

  const qs = (extra: Record<string, string>) =>
    new URLSearchParams({ periodo: String(dias), ...(searchParams.pessoa ? { pessoa: searchParams.pessoa } : {}), ...extra }).toString();

  return (
    <>
      <Cabecalho
        eyebrow="Apontamento de horas"
        titulo={gestor ? "Horas da equipe" : "Minhas horas"}
        descricao="Registre o tempo gasto em cada projeto, etapa ou tarefa."
      />

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1.5">
          {PERIODOS.map((p) => (
            <Link
              key={p.v}
              href={`/horas?${qs({ periodo: p.v })}`}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", String(dias) === p.v ? "bg-neon text-ink-950" : "bg-ink-800 text-ink-300 hover:bg-ink-700")}
            >
              {p.rotulo}
            </Link>
          ))}
        </div>
        {gestor && (
          <form className="flex gap-2">
            <input type="hidden" name="periodo" value={dias} />
            <select name="pessoa" defaultValue={searchParams.pessoa ?? ""} className="input py-2 md:w-60">
              <option value="">Todas as pessoas</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <button className="btn-secundario">Filtrar</button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo={`Total em ${dias} dias`} valor={fmtMinutos(total)} destaque />
        <Kpi rotulo="Hoje" valor={fmtMinutos(hojeMin)} />
        <Kpi rotulo="Média por dia útil" valor={fmtMinutos(Math.round(total / Math.max(1, Math.round((dias * 5) / 7))))} />
        <Kpi rotulo="Projetos" valor={projetosOrd.length} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {opcoes.projetos.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-4 font-semibold text-white">Apontar horas</h2>
              <FormHoras opcoes={opcoes} hoje={hoje} />
            </section>
          )}

          <section className="card">
            <div className="border-b border-ink-700 px-5 py-4">
              <h2 className="font-semibold text-white">Lançamentos</h2>
            </div>
            {lista.length === 0 ? (
              <Vazio icone={<Clock className="h-8 w-8" />} titulo="Nenhuma hora apontada no período" />
            ) : (
              Array.from(porDia).map(([d, itens]) => (
                <div key={d}>
                  <div className="flex items-center justify-between bg-ink-900/60 px-5 py-2 text-xs font-semibold text-ink-300">
                    <span className="capitalize">
                      {new Date(`${d}T15:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "America/Belem", weekday: "long" })}, {fmtData(new Date(`${d}T15:00:00Z`))}
                    </span>
                    <span className="tabular-nums">{fmtMinutos(itens.reduce((s, a) => s + a.minutos, 0))}</span>
                  </div>
                  <ul className="divide-y divide-ink-800">
                    {itens.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                        {gestor && <Avatar nome={a.usuario.nome} tamanho="sm" />}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-ink-100">
                            {a.descricao || a.tarefa?.titulo || a.etapa?.nome || "Trabalho no projeto"}
                          </div>
                          <div className="truncate text-xs text-ink-400">
                            {gestor && `${a.usuario.nome} · `}
                            <Link href={`/projetos/${a.projeto.id}`} className="hover:text-neon">
                              {a.projeto.codigo}
                            </Link>
                            {a.etapa && ` · ${a.etapa.nome}`}
                            {a.tarefa && ` · ${a.tarefa.titulo}`}
                          </div>
                        </div>
                        <span className="font-semibold tabular-nums text-white">{fmtMinutos(a.minutos)}</span>
                        {(gestor || a.usuarioId === u.id) && (
                          <BotaoConfirmar acao={excluirApontamento.bind(null, a.id)} mensagem="Apagar?" rotuloConfirmar="Sim" className="btn-fantasma btn-sm px-2 text-ink-500 hover:text-red-300">
                            <Trash2 className="h-3.5 w-3.5" />
                          </BotaoConfirmar>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-4 font-semibold text-white">Por projeto</h2>
            {projetosOrd.length === 0 ? (
              <p className="text-sm text-ink-500">—</p>
            ) : (
              <ul className="space-y-3">
                {projetosOrd.map((p) => (
                  <li key={p.id}>
                    <div className="mb-1 flex justify-between gap-2 text-xs">
                      <span className="truncate text-ink-200">{p.rotulo}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-white">{fmtMinutos(p.min)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-ink-800">
                      <div className="h-2 rounded-full bg-neon" style={{ width: `${(p.min / maxProj) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {gestor && pessoasOrd.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-4 font-semibold text-white">Por pessoa</h2>
              <ul className="space-y-2 text-sm">
                {pessoasOrd.map((p) => (
                  <li key={p.nome} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-ink-200">
                      <Avatar nome={p.nome} tamanho="sm" /> {p.nome}
                    </span>
                    <span className="font-semibold tabular-nums text-white">{fmtMinutos(p.min)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
