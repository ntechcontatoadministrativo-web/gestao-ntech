import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Calendar, ChevronRight, ExternalLink, GitBranch, KanbanSquare, KeyRound, Layers, LifeBuoy, MessageSquare, Paperclip, Server } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { etapaAtrasada, progresso, STATUS_ABERTOS } from "@/lib/consultas";
import { nivelCalculado, podeVerProjeto } from "@/lib/permissoes";
import { modoArmazenamento } from "@/lib/storage";
import { chamadoAberto } from "@/lib/sla";
import { dataParaInput, diasAte, fmtData, fmtMinutos, tempoRelativo } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Cabecalho,
  Kpi,
  PrazoBadge,
  Progresso,
  ROTULO_STATUS_TAREFA,
  StatusEtapaBadge,
  StatusProjetoBadge,
  TipoProjetoBadge,
  TipoTarefaIcone,
  TituloCard,
  TOM_STATUS_TAREFA,
  Vazio,
} from "@/components/ui";
import { TabelaArquivos } from "@/components/tabela-arquivos";
import { EnviarArquivo } from "@/components/upload";
import { AcoesEtapa, AcoesProjeto, CartaoDrive, NovaEtapa } from "./acoes";
import { BotaoStatusSprint, FormAmbiente, FormSprint } from "./engenharia";
import { NovoDeploy } from "../../deploys/cliente";

export default async function ProjetoPage({ params }: { params: { id: string } }) {
  const u = await exigirUsuario();
  if (!(await podeVerProjeto(u, params.id))) notFound();
  const gestor = u.perfil === "GESTOR";

  const projeto = await db.projeto.findUnique({
    where: { id: params.id },
    include: {
      clienteRel: { select: { id: true, nome: true } },
      etapas: {
        include: {
          responsavel: { select: { id: true, nome: true, ultimoAcesso: true } },
          _count: { select: { comentarios: { where: { sistema: false } }, arquivos: true } },
        },
        orderBy: { ordem: "asc" },
      },
      arquivos: {
        include: {
          etapa: { select: { nome: true, ordem: true } },
          acessos: { select: { usuarioId: true, nivel: true } },
          versoes: { orderBy: { revisao: "desc" }, take: 1, select: { tamanho: true } },
        },
        orderBy: [{ etapaId: "asc" }, { nome: "asc" }],
      },
      sprints: { include: { tarefas: { select: { status: true, pontos: true } } }, orderBy: { inicio: "desc" }, take: 6 },
      ambientes: { include: { deploys: { orderBy: { criadoEm: "desc" }, take: 1, select: { versao: true, criadoEm: true, status: true } } }, orderBy: { criadoEm: "asc" } },
      deploys: { include: { ambiente: { select: { nome: true } }, autor: { select: { nome: true } } }, orderBy: { criadoEm: "desc" }, take: 5 },
      chamados: { select: { status: true } },
      _count: { select: { credenciais: true } },
    },
  });
  if (!projeto) notFound();

  const [pessoas, clientes, modo, horasProjeto, itens] = await Promise.all([
    gestor ? db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : Promise.resolve([]),
    gestor ? db.cliente.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : Promise.resolve([]),
    modoArmazenamento(),
    db.apontamento.aggregate({ where: { projetoId: params.id }, _sum: { minutos: true } }),
    db.tarefa.findMany({
      where: { projetoId: params.id, status: { in: [...STATUS_ABERTOS, "BACKLOG"] } },
      select: { id: true, numero: true, titulo: true, status: true, tipo: true, pontos: true, responsavel: { select: { nome: true } } },
      orderBy: [{ status: "desc" }, { criadoEm: "desc" }],
      take: 200,
    }),
  ]);

  const minhasEtapas = new Set(projeto.etapas.filter((e) => e.responsavelId === u.id).map((e) => e.id));
  const etapasVisiveis = gestor ? projeto.etapas : projeto.etapas.filter((e) => minhasEtapas.has(e.id));
  const ocultas = projeto.etapas.length - etapasVisiveis.length;
  const pct = progresso(projeto.etapas);

  const arquivos = projeto.arquivos
    .map((a) => ({
      ...a,
      tamanho: a.versoes[0]?.tamanho ?? 0,
      nivel: nivelCalculado(u, a, minhasEtapas, minhasEtapas.size > 0),
    }))
    .filter((a) => gestor || a.nivel);

  const ativa = projeto.sprints.find((s) => s.status === "ATIVA");
  const ultimaSprint = projeto.sprints[0];
  // Sugestão de próxima sprint: 2 semanas a partir do fim da última (ou de hoje).
  const base = ultimaSprint && ultimaSprint.fim > new Date() ? new Date(ultimaSprint.fim.getTime() + 86400000) : new Date();
  const sugestao = {
    nome: `Sprint ${projeto.sprints.length + 1}`,
    inicio: dataParaInput(base),
    fim: dataParaInput(new Date(base.getTime() + 13 * 86400000)),
  };
  const itensAbertos = itens.filter((i) => i.status !== "BACKLOG");
  const backlog = itens.filter((i) => i.status === "BACKLOG");
  const chamadosAbertos = projeto.chamados.filter(chamadoAberto).length;

  return (
    <>
      <Link href="/projetos" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-100">
        <ArrowLeft className="h-4 w-4" /> Projetos
      </Link>

      <Cabecalho
        eyebrow={projeto.codigo}
        titulo={projeto.nome}
        descricao={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <StatusProjetoBadge status={projeto.status} />
            <TipoProjetoBadge tipo={projeto.tipo} />
            {projeto.clienteRel ? (
              gestor ? (
                <Link href={`/clientes/${projeto.clienteRel.id}`} className="inline-flex items-center gap-1 hover:text-neon">
                  <Building2 className="h-3.5 w-3.5" /> {projeto.clienteRel.nome}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> {projeto.clienteRel.nome}
                </span>
              )
            ) : (
              projeto.cliente && <span>{projeto.cliente}</span>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> {fmtData(projeto.dataInicio)} → {fmtData(projeto.prazoFinal)}
            </span>
            {projeto.repositorio && (
              <a href={projeto.repositorio} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-neon">
                <GitBranch className="h-3.5 w-3.5" /> {projeto.repositorio.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            )}
            {projeto.stack && (
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" /> {projeto.stack}
              </span>
            )}
          </span>
        }
        acoes={
          <>
            <Link href={`/quadro?projeto=${projeto.id}`} className="btn-secundario">
              <KanbanSquare className="h-4 w-4" /> Quadro
            </Link>
            {gestor && (
              <AcoesProjeto
                clientes={clientes}
                projeto={{
                  id: projeto.id,
                  nome: projeto.nome,
                  codigo: projeto.codigo,
                  tipo: projeto.tipo,
                  clienteId: projeto.clienteId,
                  repositorio: projeto.repositorio,
                  stack: projeto.stack,
                  descricao: projeto.descricao,
                  status: projeto.status,
                  dataInicio: dataParaInput(projeto.dataInicio),
                  prazoFinal: dataParaInput(projeto.prazoFinal),
                }}
              />
            )}
          </>
        }
      />

      {projeto.descricao && <p className="-mt-2 mb-6 max-w-3xl whitespace-pre-line text-sm text-ink-300">{projeto.descricao}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          rotulo="Itens em andamento"
          valor={itensAbertos.length}
          detalhe={`${backlog.length} no backlog · ${itensAbertos.reduce((s, i) => s + (i.pontos ?? 0), 0)} pts abertos`}
        />
        <Kpi rotulo="Horas apontadas" valor={fmtMinutos(horasProjeto._sum.minutos ?? 0)} />
        <Kpi rotulo="Chamados abertos" valor={<span className={chamadosAbertos ? "text-amber-300" : ""}>{chamadosAbertos}</span>} />
        <Kpi
          rotulo="Último deploy"
          valor={<span className="font-mono text-2xl">{projeto.deploys[0]?.versao ?? "—"}</span>}
          detalhe={projeto.deploys[0] ? `${projeto.deploys[0].ambiente?.nome ?? ""} ${tempoRelativo(projeto.deploys[0].criadoEm)}` : "nenhum registrado"}
        />
      </div>

      <div className="mb-6 card p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-300">
            Progresso das etapas · {projeto.etapas.filter((e) => e.status === "CONCLUIDA").length} de {projeto.etapas.length} concluídas
          </span>
          <span className="text-lg font-bold text-white">{pct}%</span>
        </div>
        <Progresso valor={pct} className="mt-3 h-2" />
        {projeto.etapas.length > 0 && (
          <div className="mt-4 flex gap-1">
            {projeto.etapas.map((e) => (
              <div
                key={e.id}
                title={`${e.nome} — ${e.status.replace(/_/g, " ").toLowerCase()}`}
                className={
                  "h-1.5 flex-1 rounded-full " +
                  (e.status === "CONCLUIDA"
                    ? "bg-neon"
                    : e.status === "AGUARDANDO_APROVACAO"
                      ? "bg-amber-300"
                      : e.status === "EM_ANDAMENTO"
                        ? "bg-sky-400"
                        : etapaAtrasada(e)
                          ? "bg-red-400"
                          : "bg-ink-600")
                }
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="card">
            <TituloCard titulo={gestor ? "Etapas" : "Suas etapas"} acao={gestor && <NovaEtapa projetoId={projeto.id} pessoas={pessoas} />} />
            {etapasVisiveis.length === 0 ? (
              <Vazio titulo="Nenhuma etapa" texto={gestor ? "Adicione as etapas do projeto." : "Você não tem etapas neste projeto."} />
            ) : (
              <ol className="divide-y divide-ink-800">
                {etapasVisiveis.map((e, i) => (
                  <li key={e.id} className="group flex items-center gap-3 px-5 py-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-800 font-mono text-xs font-bold text-ink-300">
                      {String(e.ordem).padStart(2, "0")}
                    </span>
                    <Link href={`/projetos/${projeto.id}/etapas/${e.id}`} className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink-100 group-hover:text-neon">{e.nome}</span>
                        <StatusEtapaBadge status={e.status} />
                        <PrazoBadge prazo={e.prazo} concluida={e.status === "CONCLUIDA"} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
                        <span className="inline-flex items-center gap-1.5">
                          {e.responsavel ? (
                            <>
                              <Avatar nome={e.responsavel.nome} online={e.responsavel.ultimoAcesso} tamanho="sm" /> {e.responsavel.nome}
                            </>
                          ) : (
                            <span className="text-amber-300/80">Sem responsável</span>
                          )}
                        </span>
                        <span>Prazo {fmtData(e.prazo)}</span>
                        <span className="inline-flex items-center gap-1">
                          <Paperclip className="h-3 w-3" /> {e._count.arquivos}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> {e._count.comentarios}
                        </span>
                      </div>
                    </Link>
                    {gestor ? (
                      <AcoesEtapa
                        etapa={{ id: e.id, nome: e.nome, descricao: e.descricao, responsavelId: e.responsavelId, prazo: dataParaInput(e.prazo) }}
                        pessoas={pessoas}
                        primeira={i === 0}
                        ultima={i === etapasVisiveis.length - 1}
                      />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-ink-500" />
                    )}
                  </li>
                ))}
              </ol>
            )}
            {ocultas > 0 && <div className="border-t border-ink-800 px-5 py-3 text-xs text-ink-500">+ {ocultas} etapa(s) sob responsabilidade de outras pessoas.</div>}
          </section>

          <section className="card">
            <TituloCard
              titulo="Itens em andamento"
              descricao={`${backlog.length} item(ns) no backlog`}
              acao={
                <Link href={`/quadro?projeto=${projeto.id}`} className="text-xs font-semibold text-ink-400 hover:text-neon">
                  Abrir quadro
                </Link>
              }
            />
            {itensAbertos.length === 0 ? (
              <Vazio titulo="Nada em andamento" texto="Puxe itens do backlog para a sprint no quadro." />
            ) : (
              <ul className="divide-y divide-ink-800">
                {itensAbertos.slice(0, 12).map((t) => (
                  <li key={t.id}>
                    <Link href={`/tarefas?t=${t.id}&status=todas#${t.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-ink-800/50">
                      <TipoTarefaIcone tipo={t.tipo} />
                      <span className="font-mono text-xs text-ink-400">#{t.numero}</span>
                      <span className="min-w-0 flex-1 truncate text-ink-100">{t.titulo}</span>
                      <span className="hidden text-xs text-ink-400 sm:inline">{t.responsavel?.nome.split(" ")[0] ?? "sem dono"}</span>
                      <Badge tom={TOM_STATUS_TAREFA[t.status]}>{ROTULO_STATUS_TAREFA[t.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <TituloCard
              titulo="Deploys recentes"
              acao={
                <NovoDeploy
                  projetoId={projeto.id}
                  projetos={[{ id: projeto.id, codigo: projeto.codigo, nome: projeto.nome, ambientes: projeto.ambientes.map((a) => ({ id: a.id, nome: a.nome })) }]}
                />
              }
            />
            {projeto.deploys.length === 0 ? (
              <Vazio titulo="Nenhum deploy registrado" />
            ) : (
              <ul className="divide-y divide-ink-800">
                {projeto.deploys.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className={d.status === "SUCESSO" ? "h-2 w-2 rounded-full bg-neon" : d.status === "FALHOU" ? "h-2 w-2 rounded-full bg-red-400" : "h-2 w-2 rounded-full bg-amber-300"} />
                    <span className="font-mono font-semibold text-white">{d.versao}</span>
                    {d.ambiente && <Badge>{d.ambiente.nome}</Badge>}
                    <span className="min-w-0 flex-1 truncate text-xs text-ink-400">{d.notas?.split("\n")[0]}</span>
                    <span className="shrink-0 text-xs text-ink-500">
                      {d.autor?.nome.split(" ")[0]} · {tempoRelativo(d.criadoEm)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card">
            <TituloCard titulo="Sprints" acao={gestor && <FormSprint projetoId={projeto.id} sugestao={sugestao} />} />
            {projeto.sprints.length === 0 ? (
              <Vazio titulo="Nenhuma sprint" texto={gestor ? "Organize o trabalho em ciclos de 1 a 2 semanas." : undefined} />
            ) : (
              <ul className="divide-y divide-ink-800">
                {projeto.sprints.map((s) => {
                  const total = s.tarefas.reduce((a, t) => a + (t.pontos ?? 0), 0);
                  const feitos = s.tarefas.filter((t) => t.status === "FEITA").reduce((a, t) => a + (t.pontos ?? 0), 0);
                  return (
                    <li key={s.id} className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/quadro?projeto=${projeto.id}&sprint=${s.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-ink-100 hover:text-neon">
                          {s.nome}
                        </Link>
                        {s.status === "ATIVA" ? <Badge tom="verde">ativa</Badge> : s.status === "CONCLUIDA" ? <Badge>concluída</Badge> : <Badge tom="azul">planejada</Badge>}
                        {gestor && (
                          <>
                            <BotaoStatusSprint id={s.id} status={s.status} />
                            <FormSprint
                              projetoId={projeto.id}
                              sprint={{ id: s.id, nome: s.nome, objetivo: s.objetivo, inicio: dataParaInput(s.inicio), fim: dataParaInput(s.fim) }}
                            />
                          </>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-ink-400">
                        {fmtData(s.inicio)} → {fmtData(s.fim)} · {s.tarefas.length} itens · {feitos}/{total} pts
                        {s.status === "ATIVA" && ` · ${Math.max(0, diasAte(s.fim))}d restantes`}
                      </div>
                      <Progresso valor={total ? (feitos / total) * 100 : 0} className="mt-2" />
                    </li>
                  );
                })}
              </ul>
            )}
            {!ativa && projeto.sprints.length > 0 && gestor && <div className="border-t border-ink-800 px-5 py-2 text-[11px] text-ink-500">Nenhuma sprint ativa no momento.</div>}
          </section>

          <section className="card">
            <TituloCard titulo="Ambientes" icone={<Server className="h-4 w-4 text-ink-400" />} acao={gestor && <FormAmbiente projetoId={projeto.id} />} />
            {projeto.ambientes.length === 0 ? (
              <Vazio titulo="Nenhum ambiente" texto={gestor ? "Cadastre produção e homologação com URL, branch e hospedagem." : undefined} />
            ) : (
              <ul className="divide-y divide-ink-800">
                {projeto.ambientes.map((a) => (
                  <li key={a.id} className="px-5 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink-100">{a.nome}</span>
                      {a.branch && <span className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-ink-300">{a.branch}</span>}
                      <span className="ml-auto flex items-center gap-1">
                        {a.url && (
                          <a href={a.url} target="_blank" rel="noreferrer" className="btn-fantasma btn-sm px-2" aria-label="Abrir">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {gestor && <FormAmbiente projetoId={projeto.id} ambiente={a} />}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-400">
                      {[a.hospedagem, a.url?.replace(/^https?:\/\//, "")].filter(Boolean).join(" · ")}
                      {a.deploys[0] && (
                        <span className="block font-mono">
                          {a.deploys[0].versao} · {tempoRelativo(a.deploys[0].criadoEm)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {gestor && projeto._count.credenciais > 0 && (
              <Link href={`/cofre?q=${projeto.codigo}`} className="flex items-center gap-2 border-t border-ink-800 px-5 py-2.5 text-xs text-ink-400 hover:text-neon">
                <KeyRound className="h-3.5 w-3.5" /> {projeto._count.credenciais} credencial(is) no cofre
              </Link>
            )}
          </section>

          {chamadosAbertos > 0 && (
            <Link href={`/chamados?f=abertos&projeto=${projeto.id}`} className="card flex items-center gap-3 p-4 text-sm hover:border-ink-500">
              <LifeBuoy className="h-5 w-5 text-amber-300" />
              <span className="flex-1">{chamadosAbertos} chamado(s) aberto(s) deste projeto</span>
              <ChevronRight className="h-4 w-4 text-ink-500" />
            </Link>
          )}

          {gestor && <CartaoDrive projetoId={projeto.id} pastaId={projeto.pastaDriveId} modo={modo} />}
        </div>
      </div>

      <section className="card mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 px-5 py-4">
          <div>
            <h2 className="font-semibold text-white">Arquivos do projeto</h2>
            <p className="text-xs text-ink-400">{gestor ? "Contratos, briefings, layouts, documentação." : "Arquivos liberados para você."}</p>
          </div>
          {(gestor || minhasEtapas.size > 0) && (
            <EnviarArquivo
              projetoId={projeto.id}
              ehGestor={gestor}
              etapaId={gestor ? null : etapasVisiveis[0]?.id}
              etapas={etapasVisiveis.map((e) => ({ id: e.id, nome: e.nome, ordem: e.ordem }))}
            />
          )}
        </div>
        {arquivos.length === 0 ? (
          <Vazio titulo="Nenhum arquivo ainda" texto="Envie briefing, contrato, layouts do Figma exportados, documentação. Cada novo envio com o mesmo nome vira uma nova revisão." />
        ) : (
          <TabelaArquivos arquivos={arquivos} mostrarNivel={!gestor} />
        )}
      </section>
    </>
  );
}
