import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCheck, Clock, GitPullRequest, Hourglass, LifeBuoy, Rocket } from "lucide-react";
import { exigirUsuario, type UsuarioSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { etapaAtrasada, etapaAtual, progresso, STATUS_ABERTOS } from "@/lib/consultas";
import { situacaoSla } from "@/lib/sla";
import { diasAte, estaOnline, fmtData, fmtMoeda, hojeInicio, tempoRelativo, ONLINE_JANELA_MS } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Cabecalho,
  Kpi,
  PrazoBadge,
  PrioridadeBadge,
  Progresso,
  ROTULO_STATUS_TAREFA,
  SlaBadge,
  StatusEtapaBadge,
  TipoTarefaIcone,
  TituloCard,
  TOM_STATUS_TAREFA,
  Vazio,
} from "@/components/ui";
import { BotoesAprovacao, BotoesFluxo } from "./botoes";
import { StatusTarefaControle } from "../tarefas/cliente";

export const metadata = { title: "Painel" };

export default async function Painel() {
  const u = await exigirUsuario();
  return u.perfil === "GESTOR" ? <PainelGestor u={u} /> : <PainelColaborador u={u} />;
}

const ABERTOS_CHAMADO = ["ABERTO", "EM_ATENDIMENTO", "AGUARDANDO_CLIENTE"] as const;

async function PainelGestor({ u }: { u: UsuarioSessao }) {
  const hoje = hojeInicio();
  const em3dias = new Date(hoje.getTime() + 3 * 86400000);
  const seteDias = new Date(hoje.getTime() - 7 * 86400000);

  const [projetos, aguardando, revisao, alertas, equipe, chamados, deploys, contratos, feitosSemana] = await Promise.all([
    db.projeto.findMany({
      where: { status: "ATIVO" },
      include: {
        etapas: { include: { responsavel: { select: { nome: true } } }, orderBy: { ordem: "asc" } },
        sprints: { where: { status: "ATIVA" }, include: { tarefas: { select: { status: true, pontos: true } } } },
      },
      orderBy: [{ prazoFinal: "asc" }, { criadoEm: "desc" }],
    }),
    db.etapa.findMany({
      where: { status: "AGUARDANDO_APROVACAO" },
      include: { projeto: { select: { id: true, codigo: true, nome: true } }, responsavel: { select: { nome: true } } },
      orderBy: { enviadaEm: "asc" },
    }),
    db.tarefa.findMany({
      where: { status: "REVISAO" },
      include: { projeto: { select: { codigo: true } }, responsavel: { select: { nome: true } } },
      orderBy: { atualizadoEm: "asc" },
    }),
    db.etapa.findMany({
      where: { status: { not: "CONCLUIDA" }, prazo: { lt: em3dias }, projeto: { status: "ATIVO" } },
      include: { projeto: { select: { id: true, codigo: true, nome: true } }, responsavel: { select: { nome: true, ultimoAcesso: true } } },
      orderBy: { prazo: "asc" },
      take: 10,
    }),
    db.usuario.findMany({
      where: { ativo: true },
      include: {
        tarefas: { where: { status: { in: STATUS_ABERTOS } }, select: { status: true, prazo: true, pontos: true } },
        chamados: { where: { status: { in: [...ABERTOS_CHAMADO] } }, select: { id: true } },
      },
      orderBy: { nome: "asc" },
    }),
    db.chamado.findMany({
      where: { status: { in: [...ABERTOS_CHAMADO] } },
      include: { cliente: { select: { nome: true } }, responsavel: { select: { nome: true } } },
    }),
    db.deploy.findMany({
      include: { projeto: { select: { id: true, codigo: true } }, ambiente: { select: { nome: true } }, autor: { select: { nome: true } } },
      orderBy: { criadoEm: "desc" },
      take: 6,
    }),
    db.contrato.findMany({ where: { status: "ATIVO", tipo: { not: "PROJETO" } }, select: { valorCentavos: true } }),
    db.tarefa.findMany({ where: { status: "FEITA", concluidaEm: { gte: seteDias } }, select: { pontos: true, responsavelId: true } }),
  ]);

  const online = equipe.filter((m) => estaOnline(m.ultimoAcesso));
  const mrr = contratos.reduce((s, c) => s + c.valorCentavos, 0);
  const comSla = chamados.map((c) => ({ ...c, sla: situacaoSla(c) }));
  const criticos = comSla
    .filter((c) => c.sla && c.sla.nivel !== "ok")
    .sort((a, b) => (a.sla!.nivel === "estourado" ? 0 : 1) - (b.sla!.nivel === "estourado" ? 0 : 1));
  const estourados = comSla.filter((c) => c.sla?.nivel === "estourado").length;
  const emAndamento = equipe.flatMap((m) => m.tarefas);
  const pontosSemana = feitosSemana.reduce((s, t) => s + (t.pontos ?? 0), 0);

  return (
    <>
      <Cabecalho
        eyebrow="Painel"
        titulo={`Olá, ${u.nome.split(" ")[0]}`}
        descricao="Entregas, suporte e equipe da NTECH em um lugar só."
        acoes={
          <>
            <Link href="/quadro" className="btn-secundario">
              Abrir quadro
            </Link>
            <Link href="/projetos/novo" className="btn-primario">
              Novo projeto
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi rotulo="MRR" valor={<span className="text-2xl">{fmtMoeda(mrr)}</span>} detalhe={`${contratos.length} contrato(s) recorrente(s)`} destaque />
        <Kpi rotulo="Projetos ativos" valor={projetos.length} />
        <Kpi rotulo="Em andamento" valor={emAndamento.length} detalhe={`${emAndamento.reduce((s, t) => s + (t.pontos ?? 0), 0)} pts abertos`} />
        <Kpi rotulo="Entregue (7d)" valor={feitosSemana.length} detalhe={`${pontosSemana} pts concluídos`} />
        <Kpi
          rotulo="Chamados"
          valor={chamados.length}
          detalhe={estourados ? <span className="text-red-300">{estourados} com SLA estourado</span> : "SLA em dia"}
        />
        <Kpi rotulo="Online agora" valor={online.length} detalhe={online.map((o) => o.nome.split(" ")[0]).join(", ") || "ninguém"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {(revisao.length > 0 || aguardando.length > 0) && (
            <section className="card border-amber-400/25">
              <TituloCard
                icone={<Hourglass className="h-4 w-4 text-amber-300" />}
                titulo="Aguardando você"
                descricao={`${revisao.length} item(ns) em revisão · ${aguardando.length} etapa(s) para aprovar`}
              />
              <ul className="divide-y divide-ink-800">
                {revisao.map((t) => (
                  <li key={t.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <GitPullRequest className="h-4 w-4 shrink-0 text-violet-300" />
                        <TipoTarefaIcone tipo={t.tipo} />
                        <Link href={`/tarefas?t=${t.id}&status=REVISAO#${t.id}`} className="truncate font-medium text-ink-100 hover:text-neon">
                          #{t.numero} {t.titulo}
                        </Link>
                      </div>
                      <div className="mt-0.5 text-xs text-ink-400">
                        {t.projeto?.codigo ?? "Sem projeto"} · {t.responsavel?.nome ?? "—"} · em revisão {tempoRelativo(t.atualizadoEm)}
                        {t.linkPr && (
                          <>
                            {" · "}
                            <a href={t.linkPr} target="_blank" rel="noreferrer" className="text-violet-300 hover:underline">
                              abrir PR
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                    <StatusTarefaControle id={t.id} status={t.status} gestor />
                  </li>
                ))}
                {aguardando.map((e) => (
                  <li key={e.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <Link href={`/projetos/${e.projeto.id}/etapas/${e.id}`} className="font-medium text-ink-100 hover:text-neon">
                        Etapa: {e.nome}
                      </Link>
                      <div className="mt-0.5 text-xs text-ink-400">
                        {e.projeto.codigo} · {e.projeto.nome} · enviada por {e.responsavel?.nome ?? "—"} {tempoRelativo(e.enviadaEm)}
                      </div>
                    </div>
                    <BotoesAprovacao etapaId={e.id} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <TituloCard
              titulo="Projetos ativos"
              acao={
                <Link href="/projetos" className="text-xs font-semibold text-ink-400 hover:text-neon">
                  Ver todos
                </Link>
              }
            />
            {projetos.length === 0 ? (
              <Vazio
                titulo="Nenhum projeto ativo"
                texto="Cadastre o primeiro projeto ou monte um escopo com IA."
                acao={
                  <Link href="/projetos/novo" className="btn-primario btn-sm">
                    Novo projeto
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-ink-800">
                {projetos.map((p) => {
                  const sprint = p.sprints[0];
                  const total = sprint?.tarefas.reduce((s, t) => s + (t.pontos ?? 0), 0) ?? 0;
                  const feitos = sprint?.tarefas.filter((t) => t.status === "FEITA").reduce((s, t) => s + (t.pontos ?? 0), 0) ?? 0;
                  const pct = sprint && total ? Math.round((feitos / total) * 100) : progresso(p.etapas);
                  const atual = etapaAtual(p.etapas);
                  const atr = p.etapas.filter(etapaAtrasada).length;
                  return (
                    <li key={p.id}>
                      <Link href={`/projetos/${p.id}`} className="block px-5 py-4 transition hover:bg-ink-800/50">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-ink-100">
                              <span className="mr-2 font-mono text-xs text-ink-400">{p.codigo}</span>
                              {p.nome}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-ink-400">
                              {sprint ? (
                                <>
                                  <span className="text-neon">{sprint.nome}</span> · {feitos}/{total} pts · termina {fmtData(sprint.fim)}
                                </>
                              ) : atual ? (
                                <>
                                  Etapa: <span className="text-ink-200">{atual.nome}</span>
                                  {atual.responsavel && <> · {atual.responsavel.nome}</>}
                                </>
                              ) : p.etapas.length ? (
                                "Todas as etapas concluídas"
                              ) : (
                                "Sem etapas nem sprint"
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {atr > 0 && (
                              <Badge tom="vermelho">
                                {atr} atrasada{atr > 1 && "s"}
                              </Badge>
                            )}
                            {p.prazoFinal && <span className="hidden text-xs text-ink-400 sm:inline">até {fmtData(p.prazoFinal)}</span>}
                            <span className="w-10 text-right text-sm font-semibold tabular-nums text-white">{pct}%</span>
                          </div>
                        </div>
                        <Progresso valor={pct} className="mt-3" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card">
            <TituloCard titulo="Equipe" descricao="Carga atual de cada pessoa." />
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Pessoa</th>
                    <th className="text-center">Itens abertos</th>
                    <th className="text-center">Pontos</th>
                    <th className="text-center">Atrasados</th>
                    <th className="text-center">Chamados</th>
                    <th className="text-center">Feitos (7d)</th>
                    <th>Último acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {equipe.map((m) => {
                    const atr = m.tarefas.filter((t) => t.prazo && diasAte(t.prazo) < 0).length;
                    return (
                      <tr key={m.id}>
                        <td>
                          <Link href={`/equipe/${m.id}`} className="flex items-center gap-3 hover:text-neon">
                            <Avatar nome={m.nome} online={m.ultimoAcesso} tamanho="sm" />
                            <span className="font-medium">{m.nome}</span>
                          </Link>
                        </td>
                        <td className="text-center tabular-nums">{m.tarefas.length}</td>
                        <td className="text-center tabular-nums">{m.tarefas.reduce((s, t) => s + (t.pontos ?? 0), 0)}</td>
                        <td className="text-center tabular-nums">{atr ? <span className="text-red-300">{atr}</span> : "0"}</td>
                        <td className="text-center tabular-nums">{m.chamados.length}</td>
                        <td className="text-center tabular-nums">{feitosSemana.filter((t) => t.responsavelId === m.id).length}</td>
                        <td className="text-xs text-ink-400">{estaOnline(m.ultimoAcesso) ? <span className="text-neon">online</span> : tempoRelativo(m.ultimoAcesso)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card">
            <TituloCard
              icone={<LifeBuoy className="h-4 w-4 text-violet-300" />}
              titulo="Chamados que pedem atenção"
              acao={
                <Link href="/chamados" className="text-xs font-semibold text-ink-400 hover:text-neon">
                  Todos
                </Link>
              }
            />
            {criticos.length === 0 ? (
              <Vazio titulo="SLA em dia" texto={chamados.length ? `${chamados.length} chamado(s) aberto(s), todos dentro do prazo.` : "Nenhum chamado aberto."} />
            ) : (
              <ul className="divide-y divide-ink-800">
                {criticos.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <Link href={`/chamados/${c.id}`} className="block px-5 py-3 hover:bg-ink-800/50">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-ink-100">
                          <span className="font-mono text-xs text-ink-400">#{c.numero}</span> {c.titulo}
                        </span>
                        <PrioridadeBadge prioridade={c.prioridade} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-400">
                        <SlaBadge sla={c.sla} />
                        {c.cliente?.nome ?? "sem cliente"} · {c.responsavel?.nome.split(" ")[0] ?? "na fila"}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <TituloCard icone={<AlertTriangle className="h-4 w-4 text-red-300" />} titulo="Prazos de etapas" />
            {alertas.length === 0 ? (
              <Vazio titulo="Tudo dentro do prazo" texto="Nenhuma etapa atrasada ou vencendo nos próximos dias." />
            ) : (
              <ul className="divide-y divide-ink-800">
                {alertas.map((e) => (
                  <li key={e.id} className="px-5 py-3">
                    <Link href={`/projetos/${e.projeto.id}/etapas/${e.id}`} className="block">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-ink-100">{e.nome}</span>
                        <PrazoBadge prazo={e.prazo} />
                      </div>
                      <div className="mt-0.5 text-xs text-ink-400">
                        {e.projeto.codigo} · {e.responsavel?.nome ?? "sem responsável"} · {fmtData(e.prazo)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <TituloCard
              icone={<Rocket className="h-4 w-4 text-neon" />}
              titulo="Últimos deploys"
              acao={
                <Link href="/deploys" className="text-xs font-semibold text-ink-400 hover:text-neon">
                  Histórico
                </Link>
              }
            />
            {deploys.length === 0 ? (
              <Vazio titulo="Nenhum deploy registrado" />
            ) : (
              <ul className="divide-y divide-ink-800">
                {deploys.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className={d.status === "SUCESSO" ? "h-2 w-2 shrink-0 rounded-full bg-neon" : "h-2 w-2 shrink-0 rounded-full bg-red-400"} />
                    <span className="min-w-0 flex-1 truncate">
                      <Link href={`/projetos/${d.projeto.id}`} className="font-mono text-xs text-ink-400 hover:text-neon">
                        {d.projeto.codigo}
                      </Link>{" "}
                      <span className="font-mono font-semibold text-ink-100">{d.versao}</span>
                      {d.ambiente && <span className="text-xs text-ink-400"> · {d.ambiente.nome}</span>}
                    </span>
                    <span className="shrink-0 text-[11px] text-ink-500">{tempoRelativo(d.criadoEm)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

async function PainelColaborador({ u }: { u: UsuarioSessao }) {
  const [tarefas, etapas, chamados, fila, missao] = await Promise.all([
    db.tarefa.findMany({
      where: { responsavelId: u.id, status: { in: STATUS_ABERTOS } },
      include: { projeto: { select: { codigo: true } } },
      orderBy: [{ prazo: { sort: "asc", nulls: "last" } }, { criadoEm: "desc" }],
    }),
    db.etapa.findMany({
      where: { responsavelId: u.id, status: { not: "CONCLUIDA" }, projeto: { status: { in: ["ATIVO", "PAUSADO"] } } },
      include: { projeto: { select: { id: true, codigo: true, nome: true } } },
      orderBy: [{ prazo: "asc" }, { ordem: "asc" }],
    }),
    db.chamado.findMany({
      where: { responsavelId: u.id, status: { in: [...ABERTOS_CHAMADO] } },
      include: { cliente: { select: { nome: true } } },
      orderBy: { prazoSolucao: "asc" },
    }),
    db.chamado.count({ where: { responsavelId: null, status: "ABERTO" } }),
    db.usuario.findUnique({ where: { id: u.id }, select: { missao: true } }).then((x) => x?.missao),
  ]);

  const ordemPrioridade = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 };
  const ordemStatus = { FAZENDO: 0, REVISAO: 2, A_FAZER: 1 } as Record<string, number>;
  tarefas.sort((a, b) => ordemStatus[a.status] - ordemStatus[b.status] || ordemPrioridade[a.prioridade] - ordemPrioridade[b.prioridade]);
  const atrasadas = tarefas.filter((t) => t.prazo && diasAte(t.prazo) < 0).length;
  const comSla = chamados.map((c) => ({ ...c, sla: situacaoSla(c) }));

  return (
    <>
      <Cabecalho
        eyebrow="Meu dia"
        titulo={`Olá, ${u.nome.split(" ")[0]}`}
        descricao="O que está com você agora."
        acoes={
          <Link href="/quadro?pessoa=eu" className="btn-secundario">
            Meu quadro
          </Link>
        }
      />

      {missao && (
        <section className="card mb-6 border-neon/25 bg-neon/[0.03] p-5">
          <div className="eyebrow mb-2">Sua missão</div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-100">{missao}</p>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Fazendo" valor={tarefas.filter((t) => t.status === "FAZENDO").length} destaque />
        <Kpi rotulo="A fazer" valor={tarefas.filter((t) => t.status === "A_FAZER").length} detalhe={atrasadas ? <span className="text-red-300">{atrasadas} atrasado(s)</span> : undefined} />
        <Kpi rotulo="Em revisão" valor={tarefas.filter((t) => t.status === "REVISAO").length} detalhe="aguardando o gestor" />
        <Kpi rotulo="Chamados comigo" valor={chamados.length} detalhe={fila ? `${fila} na fila sem dono` : undefined} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <TituloCard
            titulo="Meus itens"
            acao={
              <Link href="/tarefas?status=BACKLOG" className="text-xs font-semibold text-ink-400 hover:text-neon">
                Pegar do backlog
              </Link>
            }
          />
          {tarefas.length === 0 ? (
            <Vazio icone={<CheckCheck className="h-8 w-8" />} titulo="Nada com você agora" texto="Pegue um item do backlog ou peça ao gestor." />
          ) : (
            <ul className="divide-y divide-ink-800">
              {tarefas.map((t) => (
                <li key={t.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <TipoTarefaIcone tipo={t.tipo} />
                      <Link href={`/tarefas?t=${t.id}#${t.id}`} className="font-medium text-ink-100 hover:text-neon">
                        <span className="font-mono text-xs text-ink-400">#{t.numero}</span> {t.titulo}
                      </Link>
                      <Badge tom={TOM_STATUS_TAREFA[t.status]}>{ROTULO_STATUS_TAREFA[t.status]}</Badge>
                      {t.prioridade === "URGENTE" || t.prioridade === "ALTA" ? <PrioridadeBadge prioridade={t.prioridade} /> : null}
                      <PrazoBadge prazo={t.prazo} />
                    </div>
                    <div className="mt-0.5 text-xs text-ink-400">
                      {t.projeto?.codigo ?? "Sem projeto"}
                      {t.pontos ? ` · ${t.pontos} pts` : ""}
                      {t.prazo && ` · prazo ${fmtData(t.prazo)}`}
                    </div>
                  </div>
                  <StatusTarefaControle id={t.id} status={t.status} gestor={false} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="card">
            <TituloCard
              icone={<LifeBuoy className="h-4 w-4 text-violet-300" />}
              titulo="Chamados comigo"
              acao={
                <Link href="/chamados?f=fila" className="text-xs font-semibold text-ink-400 hover:text-neon">
                  Fila ({fila})
                </Link>
              }
            />
            {comSla.length === 0 ? (
              <Vazio titulo="Nenhum chamado com você" />
            ) : (
              <ul className="divide-y divide-ink-800">
                {comSla.map((c) => (
                  <li key={c.id}>
                    <Link href={`/chamados/${c.id}`} className="block px-5 py-3 hover:bg-ink-800/50">
                      <div className="text-sm font-medium text-ink-100">
                        <span className="font-mono text-xs text-ink-400">#{c.numero}</span> {c.titulo}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-400">
                        <SlaBadge sla={c.sla} /> {c.cliente?.nome}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <TituloCard titulo="Minhas etapas" />
            {etapas.length === 0 ? (
              <Vazio titulo="Nenhuma etapa com você" />
            ) : (
              <ul className="divide-y divide-ink-800">
                {etapas.map((e) => (
                  <li key={e.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/projetos/${e.projeto.id}/etapas/${e.id}`} className="text-sm font-medium text-ink-100 hover:text-neon">
                        {e.nome}
                      </Link>
                      <StatusEtapaBadge status={e.status} />
                      <PrazoBadge prazo={e.prazo} />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-ink-400">
                      <span className="inline-flex items-center gap-1">
                        {e.projeto.codigo}
                        {e.prazo && (
                          <>
                            {" · "}
                            <Clock className="h-3 w-3" /> {fmtData(e.prazo)}
                          </>
                        )}
                      </span>
                      <span className="flex items-center gap-2">
                        <BotoesFluxo etapaId={e.id} status={e.status} />
                        <Link href={`/projetos/${e.projeto.id}/etapas/${e.id}`} className="btn-fantasma btn-sm px-2" aria-label="Abrir">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      <p className="mt-6 text-center text-[11px] text-ink-500">Online = ativo nos últimos {ONLINE_JANELA_MS / 60000} minutos.</p>
    </>
  );
}
