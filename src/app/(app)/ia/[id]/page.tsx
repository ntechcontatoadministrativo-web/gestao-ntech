import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, FileQuestion, FileText, HelpCircle, Layers, ListChecks, Plug, ShieldCheck, Trash2 } from "lucide-react";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ResultadoLevantamento } from "@/lib/ia/levantamento";
import { dataParaInput, fmtDataHora, fmtTamanho } from "@/lib/utils";
import { Aviso, Badge, Cabecalho, ROTULO_TIPO_PROJETO } from "@/components/ui";
import { excluirLevantamento } from "@/actions/ia";
import { BotaoConfirmar } from "@/components/client";
import { AtualizarEnquantoProcessa } from "../cliente";
import { FormCriarProjeto } from "./form";

const TOM_IMPACTO = { baixo: "neutro", medio: "amarelo", alto: "vermelho" } as const;
const TOM_COMPLEXIDADE = { baixa: "verde", media: "amarelo", alta: "vermelho" } as const;

export default async function LevantamentoPage({ params }: { params: { id: string } }) {
  await exigirGestor();
  const lev = await db.levantamento.findUnique({
    where: { id: params.id },
    include: { projeto: { select: { id: true, codigo: true, nome: true } }, criadoPor: { select: { nome: true } } },
  });
  if (!lev) notFound();

  // Se o servidor reiniciou no meio da análise, o registro ficaria "processando" para sempre.
  const travado = lev.status === "PROCESSANDO" && Date.now() - lev.criadoEm.getTime() > 15 * 60 * 1000;
  const docs = (lev.documentos as { nome: string; tamanho: number }[]) ?? [];
  const r = lev.status === "CONCLUIDO" ? (lev.resultado as unknown as ResultadoLevantamento) : null;
  const [pessoas, clientes] = r
    ? await Promise.all([
        db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
        db.cliente.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
      ])
    : [[], []];
  const clienteSugerido = lev.cliente ? clientes.find((c) => c.nome.toLowerCase() === lev.cliente!.trim().toLowerCase())?.id : undefined;
  const pontosTotal = r?.backlog.reduce((s, b) => s + b.pontos, 0) ?? 0;

  return (
    <>
      <Link href="/ia" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-100">
        <ArrowLeft className="h-4 w-4" /> Escopos
      </Link>
      <Cabecalho
        eyebrow="Escopo com IA"
        titulo={lev.titulo}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            {lev.cliente && <span>{lev.cliente} ·</span>}
            <span>
              {docs.length} documento(s) · {fmtDataHora(lev.criadoEm)}
            </span>
            {r && <Badge tom={TOM_COMPLEXIDADE[r.complexidade]}>Complexidade {r.complexidade}</Badge>}
            {lev.projeto && (
              <Link href={`/projetos/${lev.projeto.id}`}>
                <Badge tom="roxo">Projeto {lev.projeto.codigo}</Badge>
              </Link>
            )}
          </span>
        }
        acoes={
          <BotaoConfirmar acao={excluirLevantamento.bind(null, lev.id)} mensagem="Excluir escopo?" rotuloConfirmar="Excluir" className="btn-fantasma btn-sm text-red-300">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </BotaoConfirmar>
        }
      />

      {lev.status === "PROCESSANDO" && !travado && <AtualizarEnquantoProcessa />}
      {(lev.status === "ERRO" || travado) && (
        <Aviso tom="erro">
          <b>Não foi possível concluir o escopo.</b> {travado ? "A análise foi interrompida (o servidor reiniciou). Envie o briefing de novo." : lev.erro}
        </Aviso>
      )}

      {r && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <section className="card p-6">
              <div className="eyebrow mb-2">
                {ROTULO_TIPO_PROJETO[r.tipo]} · {r.tipoProjeto}
              </div>
              <p className="text-[15px] leading-relaxed text-ink-100">{r.resumo}</p>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-ink-700 pt-4 text-center">
                <div>
                  <div className="text-xl font-bold text-white">
                    {r.estimativaHoras.minimo}–{r.estimativaHoras.maximo}h
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-ink-400">esforço</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white">{r.prazoTotalDias} dias</div>
                  <div className="text-[11px] uppercase tracking-wider text-ink-400">prazo</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white">{pontosTotal} pts</div>
                  <div className="text-[11px] uppercase tracking-wider text-ink-400">{r.backlog.length} itens no backlog</div>
                </div>
              </div>
            </section>

            {lev.projeto ? (
              <Aviso tom="ok">
                <CheckCircle2 className="mr-1 inline h-4 w-4" /> Projeto criado a partir deste escopo:{" "}
                <Link href={`/projetos/${lev.projeto.id}`} className="font-semibold underline">
                  {lev.projeto.codigo} · {lev.projeto.nome}
                </Link>
              </Aviso>
            ) : (
              <section className="card">
                <div className="border-b border-ink-700 px-5 py-4">
                  <h2 className="font-semibold text-white">Etapas, prazos e backlog propostos</h2>
                  <p className="mt-0.5 text-xs text-ink-400">
                    Total sugerido: <b className="text-ink-200">{r.prazoTotalDias} dias</b>. Ajuste nomes, dias, responsáveis e os itens do backlog e crie o projeto.
                  </p>
                </div>
                <FormCriarProjeto
                  id={lev.id}
                  titulo={lev.titulo}
                  etapas={r.etapas}
                  backlog={r.backlog}
                  pessoas={pessoas}
                  clientes={clientes}
                  clienteSugerido={clienteSugerido}
                  hoje={dataParaInput(new Date())}
                />
              </section>
            )}

            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-white">
                <ListChecks className="h-4 w-4 text-neon" /> Escopo
              </h2>
              <ul className="space-y-2.5">
                {r.escopo.map((s, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-semibold text-ink-100">{s.item}</span> <span className="text-ink-300">— {s.descricao}</span>
                  </li>
                ))}
              </ul>
              {r.foraDoEscopo.length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-400">
                    <Ban className="h-3.5 w-3.5" /> Fora do escopo
                  </h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-ink-300">
                    {r.foraDoEscopo.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </>
              )}
              {r.entregaveis.length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-ink-400">Entregáveis</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {r.entregaveis.map((e, i) => (
                      <Badge key={i}>{e}</Badge>
                    ))}
                  </div>
                </>
              )}
            </section>

            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-white">
                <Layers className="h-4 w-4 text-neon" /> Stack sugerida
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {r.stackSugerida.map((s, i) => (
                  <li key={i} className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-sm">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{s.camada}</div>
                    <div className="font-medium text-ink-100">{s.tecnologia}</div>
                    <div className="text-xs text-ink-400">{s.motivo}</div>
                  </li>
                ))}
              </ul>
              {r.integracoes.length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-400">
                    <Plug className="h-3.5 w-3.5" /> Integrações
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {r.integracoes.map((x, i) => (
                      <Badge key={i} tom="azul">
                        {x}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
              {r.requisitosNaoFuncionais.length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-400">
                    <ShieldCheck className="h-3.5 w-3.5" /> Requisitos não funcionais
                  </h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-ink-300">
                    {r.requisitosNaoFuncionais.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className="card">
              <div className="border-b border-ink-700 px-5 py-4">
                <h2 className="font-semibold text-white">Informações identificadas no briefing</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Dado</th>
                      <th>Valor</th>
                      <th>Fonte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.dadosIdentificados.map((d, i) => (
                      <tr key={i}>
                        <td className="text-ink-300">{d.campo}</td>
                        <td className="font-medium text-ink-100">{d.valor}</td>
                        <td className="text-xs text-ink-400">
                          {/a confirmar|estimativa/i.test(d.fonte) ? <Badge tom="amarelo">{d.fonte}</Badge> : d.fonte}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card p-5">
              <h2 className="mb-3 font-semibold text-white">Como prazos e pontos foram estimados</h2>
              <p className="whitespace-pre-line text-sm text-ink-300">{r.justificativaPrazos}</p>
              {r.premissas.length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-ink-400">Premissas</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-ink-300">
                    {r.premissas.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-white">
                <HelpCircle className="h-4 w-4 text-sky-300" /> Perguntas para o cliente
              </h2>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-200">
                {r.perguntasCliente.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            </section>
            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-white">
                <AlertTriangle className="h-4 w-4 text-amber-300" /> Riscos
              </h2>
              <ul className="space-y-3">
                {r.riscos.map((x, i) => (
                  <li key={i} className="text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-ink-100">{x.descricao}</span>
                      <Badge tom={TOM_IMPACTO[x.impacto]}>{x.impacto}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-400">Mitigação: {x.mitigacao}</p>
                  </li>
                ))}
              </ul>
            </section>
            {r.documentosFaltantes.length > 0 && (
              <section className="card p-5">
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-white">
                  <FileQuestion className="h-4 w-4 text-red-300" /> Materiais faltantes
                </h2>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-300">
                  {r.documentosFaltantes.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </section>
            )}
            <section className="card p-5">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-400">Documentos analisados</h2>
              <ul className="space-y-1.5 text-sm">
                {docs.map((d, i) => (
                  <li key={i} className="flex items-center gap-2 text-ink-300">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                    <span className="min-w-0 flex-1 truncate">{d.nome}</span>
                    <span className="text-xs text-ink-500">{fmtTamanho(d.tamanho)}</span>
                  </li>
                ))}
              </ul>
              {lev.tokensEntrada != null && (
                <p className="mt-3 text-[11px] text-ink-500">
                  {lev.modelo} · {lev.tokensEntrada.toLocaleString("pt-BR")} tokens lidos · {lev.tokensSaida?.toLocaleString("pt-BR")} gerados
                </p>
              )}
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
