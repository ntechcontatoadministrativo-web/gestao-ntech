import Link from "next/link";
import { CheckSquare, Clock, FolderKanban, KanbanSquare, LifeBuoy, Timer } from "lucide-react";
import type { Prisma, StatusTarefa } from "@prisma/client";
import { exigirUsuario, urlBase } from "@/lib/auth";
import { db } from "@/lib/db";
import { mensagemTarefa } from "@/lib/whatsapp";
import { cn, dataParaInput, fmtData, tempoRelativo } from "@/lib/utils";
import { Avatar, Badge, Cabecalho, PrazoBadge, PrioridadeBadge, Pontos, ROTULO_STATUS_TAREFA, TipoTarefaIcone, TOM_STATUS_TAREFA, Vazio } from "@/components/ui";
import { opcoesTarefa, STATUS_ABERTOS } from "@/lib/consultas";
import { whatsappApiAtiva } from "@/lib/whatsapp-api";
import { AcoesTarefaGestor, BotaoPegar, EditarTarefa, LinkPr, NovaTarefa, StatusTarefaControle } from "./cliente";

export const metadata = { title: "Tarefas" };

const FILTROS = [
  { v: "abertas", rotulo: "Em aberto" },
  { v: "BACKLOG", rotulo: "Backlog" },
  { v: "REVISAO", rotulo: "Em revisão" },
  { v: "FEITA", rotulo: "Feitas" },
  { v: "CANCELADA", rotulo: "Canceladas" },
  { v: "todas", rotulo: "Todas" },
] as const;

export default async function Tarefas({ searchParams }: { searchParams: { status?: string; pessoa?: string; t?: string } }) {
  const u = await exigirUsuario();
  const gestor = u.perfil === "GESTOR";
  const filtro = FILTROS.some((f) => f.v === searchParams.status) ? searchParams.status! : "abertas";

  // Colaborador vê os itens dele e, no backlog, os que ainda não têm dono.
  const pessoa: Prisma.TarefaWhereInput = gestor
    ? searchParams.pessoa
      ? { responsavelId: searchParams.pessoa }
      : {}
    : filtro === "BACKLOG"
      ? { OR: [{ responsavelId: u.id }, { responsavelId: null }] }
      : { responsavelId: u.id };
  const where: Prisma.TarefaWhereInput = {
    ...pessoa,
    ...(filtro === "abertas" ? { status: { in: STATUS_ABERTOS } } : filtro === "todas" ? {} : { status: filtro as StatusTarefa }),
  };

  const [tarefas, opcoes] = await Promise.all([
    db.tarefa.findMany({
      where,
      include: {
        responsavel: { select: { id: true, nome: true, telefone: true, ultimoAcesso: true, missao: true, modeloWhatsapp: true } },
        criadoPor: { select: { nome: true } },
        projeto: { select: { id: true, codigo: true, nome: true, cliente: true } },
        etapa: { select: { id: true, nome: true } },
        sprint: { select: { nome: true } },
        chamado: { select: { id: true, numero: true } },
      },
      orderBy: [{ prazo: { sort: "asc", nulls: "last" } }, { criadoEm: "desc" }],
      take: 300,
    }),
    opcoesTarefa(),
  ]);
  const base = urlBase();
  const ordemPrioridade = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 };
  const ordemStatus: Record<StatusTarefa, number> = { FAZENDO: 0, REVISAO: 1, A_FAZER: 2, BACKLOG: 3, FEITA: 4, CANCELADA: 5 };
  tarefas.sort(
    (a, b) =>
      ordemStatus[a.status] - ordemStatus[b.status] ||
      ordemPrioridade[a.prioridade] - ordemPrioridade[b.prioridade] ||
      (a.prazo?.getTime() ?? Infinity) - (b.prazo?.getTime() ?? Infinity),
  );

  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...(searchParams.pessoa ? { pessoa: searchParams.pessoa } : {}), status: filtro, ...extra }).toString();

  return (
    <>
      <Cabecalho
        eyebrow="Tarefas"
        titulo={gestor ? "Tarefas da equipe" : "Minhas tarefas"}
        descricao={gestor ? "Features, bugs e tarefas de todos os projetos. Designe e avise pelo WhatsApp." : "Seus itens e o backlog livre para pegar."}
        acoes={
          <>
            <Link href="/quadro" className="btn-secundario">
              <KanbanSquare className="h-4 w-4" /> Ver quadro
            </Link>
            <NovaTarefa opcoes={opcoes} apiAtiva={whatsappApiAtiva()} gestor={gestor} meuId={u.id} />
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <Link
              key={f.v}
              href={`/tarefas?${qs({ status: f.v })}`}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", filtro === f.v ? "bg-neon text-ink-950" : "bg-ink-800 text-ink-300 hover:bg-ink-700")}
            >
              {f.rotulo}
            </Link>
          ))}
        </div>
        {gestor && (
          <form className="flex gap-2">
            <input type="hidden" name="status" value={filtro} />
            <select name="pessoa" defaultValue={searchParams.pessoa ?? ""} className="input py-2 md:w-60">
              <option value="">Todas as pessoas</option>
              {opcoes.pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <button className="btn-secundario">Filtrar</button>
          </form>
        )}
      </div>

      {tarefas.length === 0 ? (
        <div className="card">
          <Vazio
            icone={<CheckSquare className="h-8 w-8" />}
            titulo="Nenhum item aqui"
            texto={gestor ? "Crie um item e envie o aviso pelo WhatsApp em um clique." : "Pegue um item do backlog ou crie um para você."}
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {tarefas.map((t) => {
            const aberta = STATUS_ABERTOS.includes(t.status) || t.status === "BACKLOG";
            const meu = t.responsavelId === u.id;
            const dados = {
              id: t.id,
              titulo: t.titulo,
              descricao: t.descricao,
              prioridade: t.prioridade,
              tipo: t.tipo,
              pontos: t.pontos,
              prazo: dataParaInput(t.prazo),
              responsavelId: t.responsavelId,
              projetoId: t.projetoId,
              etapaId: t.etapaId,
              sprintId: t.sprintId,
              linkPr: t.linkPr,
            };
            return (
              <li
                key={t.id}
                id={t.id}
                className={cn("card p-4 sm:p-5", searchParams.t === t.id && "border-neon/50 ring-1 ring-neon/30", !aberta && "opacity-70")}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-ink-400">#{t.numero}</span>
                      <TipoTarefaIcone tipo={t.tipo} comRotulo />
                      <span className={cn("font-semibold text-white", t.status === "FEITA" && "line-through decoration-ink-500")}>{t.titulo}</span>
                      <Pontos valor={t.pontos} />
                      <Badge tom={TOM_STATUS_TAREFA[t.status]}>{ROTULO_STATUS_TAREFA[t.status]}</Badge>
                      {t.prioridade !== "MEDIA" && <PrioridadeBadge prioridade={t.prioridade} />}
                      {aberta && <PrazoBadge prazo={t.prazo} />}
                    </div>
                    {t.descricao && <p className="mt-1.5 line-clamp-4 whitespace-pre-line text-sm text-ink-300">{t.descricao}</p>}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-400">
                      {t.responsavel ? (
                        (gestor || !meu) && (
                          <span className="inline-flex items-center gap-1.5">
                            <Avatar nome={t.responsavel.nome} online={t.responsavel.ultimoAcesso} tamanho="sm" /> {t.responsavel.nome}
                          </span>
                        )
                      ) : (
                        <span className="text-amber-300/80">Sem responsável</span>
                      )}
                      {t.projeto && (
                        <Link href={`/projetos/${t.projeto.id}`} className="inline-flex items-center gap-1 hover:text-neon">
                          <FolderKanban className="h-3.5 w-3.5" /> {t.projeto.codigo}
                          {t.etapa && ` · ${t.etapa.nome}`}
                        </Link>
                      )}
                      {t.sprint && (
                        <span className="inline-flex items-center gap-1">
                          <Timer className="h-3.5 w-3.5" /> {t.sprint.nome}
                        </span>
                      )}
                      {t.chamado && (
                        <Link href={`/chamados/${t.chamado.id}`} className="inline-flex items-center gap-1 hover:text-neon">
                          <LifeBuoy className="h-3.5 w-3.5" /> Chamado #{t.chamado.numero}
                        </Link>
                      )}
                      <LinkPr href={t.linkPr} />
                      {t.prazo && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {fmtData(t.prazo)}
                        </span>
                      )}
                      <span>
                        criado {tempoRelativo(t.criadoEm)}
                        {t.criadoPor && ` por ${t.criadoPor.nome.split(" ")[0]}`}
                      </span>
                      {gestor && t.avisadoEm && <span className="text-[#4ee68a]">avisado no WhatsApp {tempoRelativo(t.avisadoEm)}</span>}
                      {t.concluidaEm && <span className="text-neon">feito {tempoRelativo(t.concluidaEm)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {!t.responsavel && aberta && <BotaoPegar id={t.id} />}
                    {(gestor || meu) && <StatusTarefaControle id={t.id} status={t.status} gestor={gestor} />}
                    {gestor ? (
                      <AcoesTarefaGestor
                        tarefa={dados}
                        opcoes={opcoes}
                        meuId={u.id}
                        whatsapp={
                          t.responsavel && t.responsavelId !== u.id
                            ? {
                                nome: t.responsavel.nome,
                                telefone: t.responsavel.telefone,
                                usuarioId: t.responsavel.id,
                                apiAtiva: whatsappApiAtiva(),
                                mensagem: mensagemTarefa({ ...t, responsavel: t.responsavel, url: `${base}/tarefas?t=${t.id}` }),
                              }
                            : null
                        }
                      />
                    ) : (
                      (meu || t.criadoPorId === u.id) && <EditarTarefa tarefa={dados} opcoes={opcoes} gestor={false} meuId={u.id} />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
