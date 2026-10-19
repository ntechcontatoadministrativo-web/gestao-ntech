import Link from "next/link";
import { Download } from "lucide-react";
import type { AcaoLog } from "@prisma/client";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { filtroAuditoria, ROTULO_ACAO } from "@/lib/consultas";
import { estaOnline, fmtDataHora, fmtRevisao, tempoRelativo } from "@/lib/utils";
import { Avatar, Badge, Cabecalho, Vazio } from "@/components/ui";

export const metadata = { title: "Auditoria" };

const POR_PAGINA = 50;

type Filtros = { usuario?: string; acao?: string; arquivo?: string; de?: string; ate?: string; pagina?: string };

const tomAcao = (a: AcaoLog) =>
  a === "BAIXOU" ? "verde" : a === "VISUALIZOU" ? "azul" : ["ACESSO_NEGADO", "LOGIN_FALHOU", "BLOQUEOU", "EXCLUIU"].includes(a) ? "vermelho" : a === "LIBEROU" ? "amarelo" : "neutro";

export default async function Auditoria({ searchParams }: { searchParams: Filtros }) {
  await exigirGestor();
  const pagina = Math.max(1, Number(searchParams.pagina) || 1);
  const where = filtroAuditoria(searchParams);

  const [logs, total, usuarios, arquivoFiltro] = await Promise.all([
    db.logAcesso.findMany({
      where,
      include: {
        usuario: { select: { nome: true } },
        arquivo: { select: { id: true, nome: true, projeto: { select: { codigo: true } } } },
        versao: { select: { revisao: true } },
      },
      orderBy: { criadoEm: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    db.logAcesso.count({ where }),
    db.usuario.findMany({ select: { id: true, nome: true, ultimoAcesso: true, ativo: true }, orderBy: { nome: "asc" } }),
    searchParams.arquivo ? db.arquivo.findUnique({ where: { id: searchParams.arquivo }, select: { nome: true } }) : null,
  ]);
  const online = usuarios.filter((x) => x.ativo && estaOnline(x.ultimoAcesso));
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...searchParams, ...extra })) if (v) p.set(k, String(v));
    return p.toString();
  };

  return (
    <>
      <Cabecalho
        eyebrow="Controle de acesso"
        titulo="Auditoria"
        descricao="Registro de quem abriu, baixou, enviou ou teve acesso negado a cada arquivo — e quando."
        acoes={
          <a href={`/api/auditoria/csv?${qs({ pagina: "" })}`} className="btn-secundario">
            <Download className="h-4 w-4" /> Exportar CSV
          </a>
        }
      />

      <section className="card mb-6 p-5">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-ink-400">Online agora</div>
        {online.length === 0 ? (
          <p className="text-sm text-ink-500">Ninguém online no momento.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {online.map((o) => (
              <span key={o.id} className="inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900 py-1 pl-1 pr-3 text-sm">
                <Avatar nome={o.nome} online tamanho="sm" /> {o.nome}
                <span className="text-[11px] text-ink-500">{tempoRelativo(o.ultimoAcesso)}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      <form className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {searchParams.arquivo && <input type="hidden" name="arquivo" value={searchParams.arquivo} />}
        <select name="usuario" defaultValue={searchParams.usuario ?? ""} className="input">
          <option value="">Todas as pessoas</option>
          {usuarios.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
        <select name="acao" defaultValue={searchParams.acao ?? ""} className="input">
          <option value="">Todas as ações</option>
          {Object.entries(ROTULO_ACAO).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input type="date" name="de" defaultValue={searchParams.de} className="input" aria-label="De" />
        <input type="date" name="ate" defaultValue={searchParams.ate} className="input" aria-label="Até" />
        <button className="btn-primario">Filtrar</button>
      </form>
      {arquivoFiltro && (
        <div className="mb-4 flex items-center gap-2 text-sm text-ink-300">
          Filtrando pelo arquivo <span className="font-semibold text-white">{arquivoFiltro.nome}</span>
          <Link href={`/auditoria?${qs({ arquivo: "", pagina: "" })}`} className="text-xs text-neon hover:underline">
            remover filtro
          </Link>
        </div>
      )}

      <section className="card">
        {logs.length === 0 ? (
          <Vazio titulo="Nenhum registro para esses filtros" />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Pessoa</th>
                  <th>Ação</th>
                  <th>Arquivo</th>
                  <th className="hidden lg:table-cell">Detalhe</th>
                  <th className="hidden xl:table-cell">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap text-xs text-ink-300">{fmtDataHora(l.criadoEm)}</td>
                    <td className="whitespace-nowrap text-sm">{l.usuario?.nome ?? <span className="text-ink-500">{l.detalhe ?? "—"}</span>}</td>
                    <td>
                      <Badge tom={tomAcao(l.acao)}>{ROTULO_ACAO[l.acao]}</Badge>
                    </td>
                    <td className="max-w-[280px]">
                      {l.arquivo ? (
                        <Link href={`/arquivos/${l.arquivo.id}`} className="block truncate text-sm text-ink-200 hover:text-neon">
                          <span className="mr-1.5 font-mono text-[11px] text-ink-500">{l.arquivo.projeto.codigo}</span>
                          {l.arquivo.nome}
                          {l.versao && <span className="ml-1.5 font-mono text-[11px] text-ink-400">{fmtRevisao(l.versao.revisao)}</span>}
                        </Link>
                      ) : (
                        <span className="text-ink-500">—</span>
                      )}
                    </td>
                    <td className="hidden max-w-[260px] truncate text-xs text-ink-400 lg:table-cell">{l.usuario ? l.detalhe : ""}</td>
                    <td className="hidden font-mono text-[11px] text-ink-500 xl:table-cell">{l.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-ink-700 px-5 py-3 text-xs text-ink-400">
          <span>
            {total} registro(s) · página {pagina} de {paginas}
          </span>
          <div className="flex gap-2">
            {pagina > 1 && (
              <Link className="btn-secundario btn-sm" href={`/auditoria?${qs({ pagina: pagina - 1 })}`}>
                Anterior
              </Link>
            )}
            {pagina < paginas && (
              <Link className="btn-secundario btn-sm" href={`/auditoria?${qs({ pagina: pagina + 1 })}`}>
                Próxima
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
