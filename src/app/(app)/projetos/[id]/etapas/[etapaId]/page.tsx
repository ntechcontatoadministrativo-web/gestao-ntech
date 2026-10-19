import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleDot } from "lucide-react";
import { exigirUsuario, urlBase } from "@/lib/auth";
import { opcoesTarefa } from "@/lib/consultas";
import { mensagemEtapa } from "@/lib/whatsapp";
import { whatsappApiAtiva } from "@/lib/whatsapp-api";
import { BotaoWhatsapp } from "@/components/whatsapp";
import { NovaTarefa } from "@/app/(app)/tarefas/cliente";
import { BotaoApontarHoras } from "@/components/apontar-horas";
import { opcoesHoras } from "@/lib/consultas";
import { diaBelem, fmtMinutos } from "@/lib/utils";
import { db } from "@/lib/db";
import { nivelCalculado } from "@/lib/permissoes";
import { fmtData, fmtDataHora, tempoRelativo } from "@/lib/utils";
import { Avatar, Cabecalho, PrazoBadge, StatusEtapaBadge, Vazio } from "@/components/ui";
import { TabelaArquivos } from "@/components/tabela-arquivos";
import { EnviarArquivo } from "@/components/upload";
import { BotoesAprovacao, BotoesFluxo } from "@/app/(app)/painel/botoes";
import { FormComentario, StatusManual } from "./cliente";

export default async function EtapaPage({ params }: { params: { id: string; etapaId: string } }) {
  const u = await exigirUsuario();
  const etapa = await db.etapa.findUnique({
    where: { id: params.etapaId },
    include: {
      projeto: { select: { id: true, codigo: true, nome: true, cliente: true } },
      responsavel: { select: { id: true, nome: true, cargo: true, telefone: true, ultimoAcesso: true, missao: true, modeloWhatsapp: true } },
      tarefas: { where: { status: { in: ["BACKLOG", "A_FAZER", "FAZENDO", "REVISAO"] } }, include: { responsavel: { select: { nome: true } } }, orderBy: { prazo: "asc" } },
      aprovadaPor: { select: { nome: true } },
      comentarios: { include: { autor: { select: { nome: true } } }, orderBy: { criadoEm: "asc" } },
      arquivos: {
        include: {
          acessos: { select: { usuarioId: true, nivel: true } },
          versoes: { orderBy: { revisao: "desc" }, take: 1, select: { tamanho: true } },
        },
        orderBy: { nome: "asc" },
      },
    },
  });
  if (!etapa || etapa.projetoId !== params.id) notFound();

  const gestor = u.perfil === "GESTOR";
  const responsavel = etapa.responsavelId === u.id;
  if (!gestor && !responsavel) notFound();

  const opcoes = gestor ? await opcoesTarefa() : null;
  const [opHoras, horasEtapa] = await Promise.all([
    gestor || responsavel ? opcoesHoras(u) : Promise.resolve(null),
    db.apontamento.aggregate({ where: { etapaId: etapa.id }, _sum: { minutos: true } }),
  ]);
  const minhas = new Set(responsavel ? [etapa.id] : []);
  const arquivos = etapa.arquivos
    .map((a) => ({ ...a, tamanho: a.versoes[0]?.tamanho ?? 0, nivel: nivelCalculado(u, a, minhas, responsavel) }))
    .filter((a) => gestor || a.nivel);

  return (
    <>
      <Link href={`/projetos/${etapa.projeto.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-100">
        <ArrowLeft className="h-4 w-4" /> {etapa.projeto.codigo} · {etapa.projeto.nome}
      </Link>

      <Cabecalho
        eyebrow={`Etapa ${String(etapa.ordem).padStart(2, "0")}`}
        titulo={etapa.nome}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <StatusEtapaBadge status={etapa.status} />
            <PrazoBadge prazo={etapa.prazo} concluida={etapa.status === "CONCLUIDA"} />
          </span>
        }
        acoes={
          <>
            {opHoras && <BotaoApontarHoras opcoes={opHoras} hoje={diaBelem()} padrao={{ projetoId: etapa.projeto.id, etapaId: etapa.id }} />}
            {responsavel && <BotoesFluxo etapaId={etapa.id} status={etapa.status} />}
            {gestor && etapa.status === "AGUARDANDO_APROVACAO" && <BotoesAprovacao etapaId={etapa.id} />}
            {gestor && etapa.responsavel && (
              <BotaoWhatsapp
                className="btn-sm"
                rotulo="Avisar no WhatsApp"
                envio={whatsappApiAtiva() ? { usuarioId: etapa.responsavel.id, referencia: `etapa:${etapa.id}` } : null}
                nome={etapa.responsavel.nome}
                telefone={etapa.responsavel.telefone}
                mensagem={mensagemEtapa({
                  ...etapa,
                  responsavel: etapa.responsavel,
                  gestor: u,
                  url: `${urlBase()}/projetos/${etapa.projeto.id}/etapas/${etapa.id}`,
                })}
              />
            )}
            {gestor && <StatusManual etapaId={etapa.id} status={etapa.status} />}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {etapa.descricao && (
            <section className="card p-5">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">O que entregar</h2>
              <p className="whitespace-pre-line text-sm text-ink-200">{etapa.descricao}</p>
            </section>
          )}

          <section className="card">
            <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
              <h2 className="font-semibold text-white">Arquivos da etapa</h2>
              {(gestor || responsavel) && <EnviarArquivo projetoId={etapa.projeto.id} etapaId={etapa.id} ehGestor={gestor} className="btn-primario btn-sm" rotulo="Enviar" />}
            </div>
            {arquivos.length === 0 ? (
              <Vazio titulo="Nenhum arquivo nesta etapa" />
            ) : (
              <TabelaArquivos arquivos={arquivos} mostrarEtapa={false} mostrarNivel={!gestor} />
            )}
          </section>

          <section className="card">
            <div className="border-b border-ink-700 px-5 py-4">
              <h2 className="font-semibold text-white">Comentários e histórico</h2>
            </div>
            <div className="px-5 py-4">
              {etapa.comentarios.length === 0 && <p className="mb-4 text-sm text-ink-500">Nenhum comentário ainda.</p>}
              <ul className="space-y-4">
                {etapa.comentarios.map((c) =>
                  c.sistema ? (
                    <li key={c.id} className="flex items-center gap-2 pl-1 text-xs text-ink-400">
                      <CircleDot className="h-3 w-3 text-ink-500" />
                      <span>
                        <span className="font-semibold text-ink-300">{c.autor?.nome ?? "Sistema"}</span> {c.texto}
                      </span>
                      <span className="text-ink-500">· {fmtDataHora(c.criadoEm)}</span>
                    </li>
                  ) : (
                    <li key={c.id} className="flex gap-3">
                      <Avatar nome={c.autor?.nome ?? "?"} tamanho="sm" />
                      <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm border border-ink-700 bg-ink-900 px-4 py-3">
                        <div className="mb-1 flex items-center gap-2 text-xs">
                          <span className="font-semibold text-ink-100">{c.autor?.nome ?? "—"}</span>
                          <span className="text-ink-500" title={fmtDataHora(c.criadoEm)}>
                            {tempoRelativo(c.criadoEm)}
                          </span>
                        </div>
                        <p className="whitespace-pre-line break-words text-sm text-ink-200">{c.texto}</p>
                      </div>
                    </li>
                  ),
                )}
              </ul>
              <FormComentario etapaId={etapa.id} />
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-ink-400">Detalhes</h2>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-xs text-ink-400">Responsável</dt>
                <dd className="mt-1.5">
                  {etapa.responsavel ? (
                    <span className="flex items-center gap-2.5">
                      <Avatar nome={etapa.responsavel.nome} online={etapa.responsavel.ultimoAcesso} />
                      <span>
                        <span className="block font-medium text-ink-100">{etapa.responsavel.nome}</span>
                        {etapa.responsavel.cargo && <span className="block text-xs text-ink-400">{etapa.responsavel.cargo}</span>}
                      </span>
                    </span>
                  ) : (
                    <span className="text-amber-300">Sem responsável</span>
                  )}
                </dd>
              </div>
              <Linha rotulo="Prazo" valor={fmtData(etapa.prazo)} />
              <Linha rotulo="Horas apontadas" valor={fmtMinutos(horasEtapa._sum.minutos ?? 0)} />
              <Linha rotulo="Iniciada em" valor={fmtDataHora(etapa.iniciadaEm)} />
              <Linha rotulo="Enviada para aprovação" valor={fmtDataHora(etapa.enviadaEm)} />
              <Linha
                rotulo="Concluída"
                valor={etapa.concluidaEm ? `${fmtDataHora(etapa.concluidaEm)}${etapa.aprovadaPor ? ` · aprovada por ${etapa.aprovadaPor.nome}` : ""}` : "—"}
              />
            </dl>
          </section>
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-400">Tarefas em aberto</h2>
              <Link href="/tarefas" className="text-xs text-ink-400 hover:text-neon">
                Todas
              </Link>
            </div>
            {etapa.tarefas.filter((t) => gestor || t.responsavelId === u.id).length === 0 ? (
              <p className="text-sm text-ink-500">Nenhuma tarefa aberta nesta etapa.</p>
            ) : (
              <ul className="space-y-2">
                {etapa.tarefas.filter((t) => gestor || t.responsavelId === u.id).map((t) => (
                  <li key={t.id}>
                    <Link href={`/tarefas?t=${t.id}#${t.id}`} className="block rounded-lg border border-ink-700 px-3 py-2 text-sm hover:border-ink-500">
                      <span className="block font-medium text-ink-100">{t.titulo}</span>
                      <span className="text-xs text-ink-400">
                        #{t.numero} · {t.responsavel?.nome ?? "sem dono"} · prazo {fmtData(t.prazo)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {gestor && opcoes && (
              <div className="mt-3">
                <NovaTarefa
                  opcoes={opcoes}
                  rotulo="Item nesta etapa"
                  apiAtiva={whatsappApiAtiva()}
                  gestor
                  meuId={u.id}
                  padrao={{ projetoId: etapa.projeto.id, etapaId: etapa.id, responsavelId: etapa.responsavelId ?? undefined }}
                />
              </div>
            )}
          </section>
          {responsavel && etapa.status === "EM_ANDAMENTO" && (
            <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 text-xs text-ink-400">
              Quando terminar, envie os arquivos finais e clique em <span className="font-semibold text-ink-200">Enviar para aprovação</span>. O gestor revisa e conclui a etapa.
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-400">{rotulo}</dt>
      <dd className="mt-0.5 text-ink-200">{valor}</dd>
    </div>
  );
}
