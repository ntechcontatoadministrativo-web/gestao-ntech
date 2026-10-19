import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Eye, FileWarning, ShieldOff } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarLog } from "@/lib/log";
import { nivelCalculado, nivelNoArquivo, podeBaixar, podeVer } from "@/lib/permissoes";
import { emitirTicket } from "@/lib/tickets";
import { visualizavel } from "@/lib/storage";
import { ROTULO_ACAO } from "@/lib/consultas";
import { cn, fmtDataHora, fmtRevisao, fmtTamanho } from "@/lib/utils";
import { Avatar, Badge, Cabecalho, NivelBadge } from "@/components/ui";
import { IconeArquivo } from "@/components/tabela-arquivos";
import { EnviarArquivo } from "@/components/upload";
import { VisualizadorImagem, VisualizadorPdf } from "@/components/visualizador";
import { PainelAcesso } from "./acesso";

export default async function ArquivoPage({ params, searchParams }: { params: { id: string }; searchParams: { v?: string } }) {
  const u = await exigirUsuario();
  const gestor = u.perfil === "GESTOR";

  const arquivo = await db.arquivo.findUnique({
    where: { id: params.id },
    include: {
      projeto: { select: { id: true, codigo: true, nome: true } },
      etapa: { select: { id: true, nome: true, ordem: true, responsavelId: true } },
      versoes: { include: { enviadoPor: { select: { nome: true } } }, orderBy: { revisao: "desc" } },
      acessos: { select: { usuarioId: true, nivel: true } },
    },
  });
  if (!arquivo) notFound();

  const nivel = await nivelNoArquivo(u, arquivo.id);
  if (!podeVer(nivel)) {
    await registrarLog({ acao: "ACESSO_NEGADO", usuarioId: u.id, arquivoId: arquivo.id, detalhe: "Tela do arquivo" });
    return (
      <div className="card mx-auto mt-10 max-w-md p-8 text-center">
        <ShieldOff className="mx-auto h-10 w-10 text-red-300" />
        <h1 className="mt-4 text-lg font-semibold text-white">Acesso bloqueado</h1>
        <p className="mt-2 text-sm text-ink-400">Este arquivo não está liberado para você. Se precisar dele, fale com o gestor.</p>
        <Link href="/painel" className="btn-secundario mt-6">
          Voltar ao painel
        </Link>
      </div>
    );
  }

  const versao = arquivo.versoes.find((v) => v.id === searchParams.v) ?? arquivo.versoes[0];
  if (!versao) notFound();
  const ehAtual = versao.revisao === arquivo.revisaoAtual;
  const podeVisualizarAqui = visualizavel(versao.mimeType);

  let srcVer: string | null = null;
  if (podeVisualizarAqui) {
    const t = await emitirTicket("ver", { uid: u.id, versaoId: versao.id }, "2h");
    srcVer = `/api/arquivos/${arquivo.id}/conteudo?modo=ver&v=${versao.id}&t=${encodeURIComponent(t)}`;
    await registrarLog({ acao: "VISUALIZOU", usuarioId: u.id, arquivoId: arquivo.id, versaoId: versao.id, detalhe: fmtRevisao(versao.revisao) });
  }
  const marca = `${u.nome} · ${u.email} · ${fmtDataHora(new Date())}`;
  const podeRevisar = gestor || (!!arquivo.etapa && arquivo.etapa.responsavelId === u.id);

  // Dados do painel de acesso (só gestor)
  let pessoas: { id: string; nome: string; perfil: string; ultimoAcesso: Date | null; individual: string | null; efetivo: ReturnType<typeof nivelCalculado> }[] = [];
  let logs: Awaited<ReturnType<typeof buscarLogs>> = [];
  if (gestor) {
    const [usuarios, etapasProjeto] = await Promise.all([
      db.usuario.findMany({ where: { ativo: true, perfil: "COLABORADOR" }, orderBy: { nome: "asc" } }),
      db.etapa.findMany({ where: { projetoId: arquivo.projetoId }, select: { id: true, responsavelId: true } }),
    ]);
    pessoas = usuarios.map((p) => {
      const minhas = new Set(etapasProjeto.filter((e) => e.responsavelId === p.id).map((e) => e.id));
      return {
        id: p.id,
        nome: p.nome,
        perfil: p.perfil,
        ultimoAcesso: p.ultimoAcesso,
        individual: arquivo.acessos.find((a) => a.usuarioId === p.id)?.nivel ?? null,
        efetivo: nivelCalculado({ ...p }, arquivo, minhas, minhas.size > 0),
      };
    });
    // Quem tem acesso aparece primeiro.
    pessoas.sort((a, b) => Number(!!b.efetivo) - Number(!!a.efetivo) || a.nome.localeCompare(b.nome));
    logs = await buscarLogs(arquivo.id);
  }

  const urlBaixar = (vid: string) => `/api/arquivos/${arquivo.id}/conteudo?v=${vid}`;

  return (
    <>
      <Link href={`/projetos/${arquivo.projeto.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-100">
        <ArrowLeft className="h-4 w-4" /> {arquivo.projeto.codigo} · {arquivo.projeto.nome}
      </Link>

      <Cabecalho
        eyebrow={arquivo.etapa ? `Etapa ${String(arquivo.etapa.ordem).padStart(2, "0")} · ${arquivo.etapa.nome}` : "Arquivo geral do projeto"}
        titulo={
          <span className="flex items-center gap-3">
            <IconeArquivo ext={arquivo.extensao} className="h-7 w-7 shrink-0 text-ink-400" />
            <span className="break-all">{arquivo.nome}</span>
          </span>
        }
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-ink-700 px-1.5 py-0.5 font-mono text-xs font-semibold text-white">{fmtRevisao(versao.revisao)}</span>
            {!ehAtual && <Badge tom="amarelo">Revisão antiga — a atual é {fmtRevisao(arquivo.revisaoAtual)}</Badge>}
            <span>
              {fmtTamanho(versao.tamanho)} · enviado por {versao.enviadoPor?.nome ?? "—"} em {fmtDataHora(versao.criadoEm)}
            </span>
            {!gestor && <NivelBadge nivel={nivel} />}
          </span>
        }
        acoes={
          <>
            {podeRevisar && <EnviarArquivo projetoId={arquivo.projetoId} arquivoId={arquivo.id} ehGestor={gestor} rotulo="Nova revisão" className="btn-secundario" />}
            {podeBaixar(nivel) && (
              <a href={urlBaixar(versao.id)} className="btn-primario">
                <Download className="h-4 w-4" /> Baixar {fmtRevisao(versao.revisao)}
              </a>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="card p-3 sm:p-4">
            {srcVer ? (
              versao.mimeType === "application/pdf" ? (
                <VisualizadorPdf src={srcVer} marca={marca} />
              ) : (
                <VisualizadorImagem src={srcVer} marca={marca} alt={arquivo.nome} />
              )
            ) : (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <FileWarning className="h-8 w-8 text-ink-500" />
                <div className="mt-3 font-medium text-ink-100">Pré-visualização indisponível para .{arquivo.extensao ?? "?"}</div>
                <p className="mt-1 max-w-sm text-sm text-ink-400">
                  {podeBaixar(nivel)
                    ? "Baixe o arquivo para abrir no programa correspondente (VS Code, Figma, Excel…). O download fica registrado."
                    : "Você tem acesso apenas para visualização e este formato não pode ser exibido no navegador."}
                </p>
              </div>
            )}
          </section>

          <section className="card">
            <div className="border-b border-ink-700 px-5 py-4">
              <h2 className="font-semibold text-white">Revisões</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Rev.</th>
                    <th>Enviado</th>
                    <th>Por</th>
                    <th className="hidden md:table-cell">Tamanho</th>
                    <th className="hidden md:table-cell">Observação</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {arquivo.versoes.map((v) => (
                    <tr key={v.id} className={cn(v.id === versao.id && "bg-neon/[0.04]")}>
                      <td>
                        <span className="rounded bg-ink-700 px-1.5 py-0.5 font-mono text-[11px] font-semibold">{fmtRevisao(v.revisao)}</span>
                        {v.revisao === arquivo.revisaoAtual && <span className="ml-2 text-[10px] font-bold uppercase text-neon">atual</span>}
                      </td>
                      <td className="whitespace-nowrap text-xs text-ink-300">{fmtDataHora(v.criadoEm)}</td>
                      <td className="text-xs text-ink-300">{v.enviadoPor?.nome ?? "—"}</td>
                      <td className="hidden text-xs text-ink-400 md:table-cell">{fmtTamanho(v.tamanho)}</td>
                      <td className="hidden max-w-[220px] truncate text-xs text-ink-400 md:table-cell">{v.observacao ?? ""}</td>
                      <td className="whitespace-nowrap text-right">
                        <Link href={`/arquivos/${arquivo.id}?v=${v.id}`} className="btn-fantasma btn-sm">
                          <Eye className="h-3.5 w-3.5" /> Abrir
                        </Link>
                        {podeBaixar(nivel) && (
                          <a href={urlBaixar(v.id)} className="btn-fantasma btn-sm">
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {gestor && (
            <section className="card">
              <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
                <h2 className="font-semibold text-white">Quem acessou</h2>
                <Link href={`/auditoria?arquivo=${arquivo.id}`} className="text-xs font-semibold text-ink-400 hover:text-neon">
                  Ver tudo
                </Link>
              </div>
              {logs.length === 0 ? (
                <p className="px-5 py-6 text-sm text-ink-500">Nenhum acesso registrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="tabela">
                    <tbody>
                      {logs.map((l) => (
                        <tr key={l.id}>
                          <td className="whitespace-nowrap text-xs text-ink-400">{fmtDataHora(l.criadoEm)}</td>
                          <td className="text-sm">{l.usuario?.nome ?? "—"}</td>
                          <td>
                            <Badge tom={l.acao === "BAIXOU" ? "verde" : l.acao === "ACESSO_NEGADO" || l.acao === "BLOQUEOU" ? "vermelho" : l.acao === "VISUALIZOU" ? "azul" : "neutro"}>
                              {ROTULO_ACAO[l.acao]}
                            </Badge>
                          </td>
                          <td className="text-xs text-ink-400">{l.detalhe ?? (l.versao ? fmtRevisao(l.versao.revisao) : "")}</td>
                          <td className="hidden font-mono text-[11px] text-ink-500 lg:table-cell">{l.ip ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>

        {gestor && (
          <aside className="space-y-4">
            <PainelAcesso
              arquivoId={arquivo.id}
              acessoEquipe={arquivo.acessoEquipe}
              ehDaEtapa={!!arquivo.etapa}
              pessoas={pessoas.map((p) => ({ ...p, online: p.ultimoAcesso ? Date.now() - p.ultimoAcesso.getTime() < 120000 : false }))}
            />
          </aside>
        )}
      </div>
      {!gestor && (
        <p className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] text-ink-500">
          <Avatar nome={u.nome} tamanho="sm" /> Seus acessos a este arquivo são registrados.
        </p>
      )}
    </>
  );
}

function buscarLogs(arquivoId: string) {
  return db.logAcesso.findMany({
    where: { arquivoId },
    include: { usuario: { select: { nome: true } }, versao: { select: { revisao: true } } },
    orderBy: { criadoEm: "desc" },
    take: 25,
  });
}
