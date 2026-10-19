import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, FolderKanban, Lock, MessageCircle, User } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDuracao, situacaoSla } from "@/lib/sla";
import { cn, fmtDataHora, tempoRelativo } from "@/lib/utils";
import { Avatar, Badge, Cabecalho, PrioridadeBadge, ROTULO_STATUS_TAREFA, SlaBadge, StatusChamadoBadge, TituloCard } from "@/components/ui";
import { BotoesChamado, EditarChamado, FormResposta } from "../cliente";
import { opcoesChamado } from "../opcoes";

export default async function ChamadoPage({ params }: { params: { id: string } }) {
  await exigirUsuario();
  const c = await db.chamado.findUnique({
    where: { id: params.id },
    include: {
      cliente: { select: { id: true, nome: true, telefone: true, contatoNome: true } },
      projeto: { select: { id: true, codigo: true, nome: true } },
      contrato: { select: { titulo: true, slaRespostaHoras: true, slaSolucaoHoras: true } },
      responsavel: { select: { nome: true, ultimoAcesso: true } },
      criadoPor: { select: { nome: true } },
      respostas: { include: { autor: { select: { nome: true } } }, orderBy: { criadoEm: "asc" } },
      tarefas: { select: { id: true, numero: true, status: true, titulo: true } },
    },
  });
  if (!c) notFound();
  const opcoes = await opcoesChamado();
  const sla = situacaoSla(c);
  const tempoResposta = c.primeiraRespostaEm ? Math.round((c.primeiraRespostaEm.getTime() - c.criadoEm.getTime()) / 60000) : null;
  const tempoSolucao = c.resolvidoEm ? Math.round((c.resolvidoEm.getTime() - c.criadoEm.getTime()) / 60000) : null;

  return (
    <>
      <Link href="/chamados" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-100">
        <ArrowLeft className="h-4 w-4" /> Chamados
      </Link>
      <Cabecalho
        eyebrow={`Chamado #${c.numero}`}
        titulo={c.titulo}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <StatusChamadoBadge status={c.status} />
            <PrioridadeBadge prioridade={c.prioridade} />
            <SlaBadge sla={sla} />
            <span className="text-xs text-ink-400">
              aberto {tempoRelativo(c.criadoEm)} por {c.criadoPor?.nome.split(" ")[0] ?? "—"} via {c.canal}
            </span>
          </span>
        }
        acoes={
          <>
            <EditarChamado
              id={c.id}
              opcoes={opcoes}
              chamado={{
                titulo: c.titulo,
                descricao: c.descricao,
                solicitante: c.solicitante,
                prioridade: c.prioridade,
                clienteId: c.clienteId,
                projetoId: c.projetoId,
                responsavelId: c.responsavelId,
              }}
            />
          </>
        }
      />

      <div className="mb-6 flex justify-end">
        <BotoesChamado id={c.id} status={c.status} temTarefa={c.tarefas.length > 0} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {c.descricao && (
            <section className="card p-5">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">Descrição</div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-200">{c.descricao}</p>
            </section>
          )}

          <section className="card">
            <TituloCard titulo="Atendimento" descricao="Respostas ao cliente e notas internas da equipe." />
            <ol className="space-y-4 px-5 py-5">
              {c.respostas.length === 0 && <li className="text-sm text-ink-400">Nenhuma resposta ainda.</li>}
              {c.respostas.map((r) =>
                r.sistema ? (
                  <li key={r.id} className="text-center text-[11px] text-ink-500">
                    {r.texto} · {tempoRelativo(r.criadoEm)}
                  </li>
                ) : (
                  <li key={r.id} className="flex gap-3">
                    <Avatar nome={r.autor?.nome ?? "?"} tamanho="sm" />
                    <div className={cn("min-w-0 flex-1 rounded-xl border px-4 py-3", r.interna ? "border-amber-400/20 bg-amber-400/[0.04]" : "border-ink-700 bg-ink-900")}>
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-ink-400">
                        <span className="font-semibold text-ink-200">{r.autor?.nome ?? "—"}</span>
                        {r.interna ? (
                          <span className="inline-flex items-center gap-1 text-amber-300">
                            <Lock className="h-3 w-3" /> nota interna
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" /> resposta ao cliente
                          </span>
                        )}
                        <span className="ml-auto" title={fmtDataHora(r.criadoEm)}>
                          {tempoRelativo(r.criadoEm)}
                        </span>
                      </div>
                      <p className="whitespace-pre-line text-sm text-ink-100">{r.texto}</p>
                    </div>
                  </li>
                ),
              )}
            </ol>
            <div className="border-t border-ink-700 px-5 py-4">
              <FormResposta id={c.id} status={c.status} />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card divide-y divide-ink-800 text-sm">
            <div className="flex items-center gap-3 px-5 py-3">
              <Building2 className="h-4 w-4 text-ink-400" />
              {c.cliente ? (
                <Link href={`/clientes/${c.cliente.id}`} className="hover:text-neon">
                  {c.cliente.nome}
                </Link>
              ) : (
                <span className="text-ink-400">Sem cliente</span>
              )}
            </div>
            {c.solicitante && (
              <div className="flex items-center gap-3 px-5 py-3">
                <User className="h-4 w-4 text-ink-400" /> {c.solicitante}
              </div>
            )}
            <div className="flex items-center gap-3 px-5 py-3">
              <FolderKanban className="h-4 w-4 text-ink-400" />
              {c.projeto ? (
                <Link href={`/projetos/${c.projeto.id}`} className="hover:text-neon">
                  {c.projeto.codigo} · {c.projeto.nome}
                </Link>
              ) : (
                <span className="text-ink-400">Sem projeto</span>
              )}
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              {c.responsavel ? (
                <>
                  <Avatar nome={c.responsavel.nome} online={c.responsavel.ultimoAcesso} tamanho="sm" /> {c.responsavel.nome}
                </>
              ) : (
                <span className="text-amber-300/80">Na fila, sem responsável</span>
              )}
            </div>
          </section>

          <section className="card p-5 text-sm">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-ink-400">SLA</div>
            <dl className="space-y-2">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-400">Responder até</dt>
                <dd className="text-right">{fmtDataHora(c.prazoResposta)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-400">1ª resposta</dt>
                <dd className={cn("text-right", c.primeiraRespostaEm && c.prazoResposta && c.primeiraRespostaEm > c.prazoResposta && "text-red-300")}>
                  {tempoResposta !== null ? `em ${fmtDuracao(tempoResposta)}` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-400">Resolver até</dt>
                <dd className="text-right">{fmtDataHora(c.prazoSolucao)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-400">Resolvido</dt>
                <dd className={cn("text-right", c.resolvidoEm && c.prazoSolucao && c.resolvidoEm > c.prazoSolucao && "text-red-300")}>
                  {tempoSolucao !== null ? `em ${fmtDuracao(tempoSolucao)}` : "—"}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-ink-500">{c.contrato ? `Pelo contrato "${c.contrato.titulo}".` : "SLA padrão (cliente sem contrato de suporte)."}</p>
          </section>

          {c.tarefas.length > 0 && (
            <section className="card">
              <TituloCard titulo="Itens no quadro" />
              <ul className="divide-y divide-ink-800">
                {c.tarefas.map((t) => (
                  <li key={t.id}>
                    <Link href={`/tarefas?t=${t.id}&status=todas#${t.id}`} className="flex items-center gap-2 px-5 py-3 text-sm hover:bg-ink-800/50">
                      <span className="font-mono text-xs text-ink-400">#{t.numero}</span>
                      <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
                      <Badge>{ROTULO_STATUS_TAREFA[t.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
