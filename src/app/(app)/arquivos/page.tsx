import { Files, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { filtroArquivosVisiveis, nivelCalculado } from "@/lib/permissoes";
import { Cabecalho, Vazio } from "@/components/ui";
import { TabelaArquivos } from "@/components/tabela-arquivos";

export const metadata = { title: "Arquivos" };

export default async function Arquivos({ searchParams }: { searchParams: { q?: string; projeto?: string } }) {
  const u = await exigirUsuario();
  const gestor = u.perfil === "GESTOR";
  const q = searchParams.q?.trim();

  const filtros: Prisma.ArquivoWhereInput[] = [];
  if (!gestor) filtros.push(filtroArquivosVisiveis(u.id));
  if (q) filtros.push({ nome: { contains: q, mode: "insensitive" } });
  if (searchParams.projeto) filtros.push({ projetoId: searchParams.projeto });

  const [arquivos, projetos, minhasEtapas] = await Promise.all([
    db.arquivo.findMany({
      where: { AND: filtros },
      include: {
        projeto: { select: { codigo: true, nome: true } },
        etapa: { select: { nome: true, ordem: true } },
        acessos: { select: { usuarioId: true, nivel: true } },
        versoes: { orderBy: { revisao: "desc" }, take: 1, select: { tamanho: true } },
      },
      orderBy: { atualizadoEm: "desc" },
      take: 300,
    }),
    db.projeto.findMany({
      where: gestor ? {} : { OR: [{ etapas: { some: { responsavelId: u.id } } }, { arquivos: { some: filtroArquivosVisiveis(u.id) } }] },
      select: { id: true, codigo: true, nome: true },
      orderBy: { codigo: "desc" },
    }),
    gestor ? Promise.resolve([]) : db.etapa.findMany({ where: { responsavelId: u.id }, select: { id: true, projetoId: true } }),
  ]);

  const etapasSet = new Set(minhasEtapas.map((e) => e.id));
  const projetosEquipe = new Set(minhasEtapas.map((e) => e.projetoId));
  const linhas = arquivos.map((a) => ({
    ...a,
    tamanho: a.versoes[0]?.tamanho ?? 0,
    nivel: nivelCalculado(u, a, etapasSet, projetosEquipe.has(a.projetoId)),
  }));

  return (
    <>
      <Cabecalho
        eyebrow="Arquivos"
        titulo={gestor ? "Todos os arquivos" : "Arquivos liberados para você"}
        descricao="Os arquivos ficam no Google Drive do escritório; todo acesso passa pelo sistema e é registrado."
      />
      <form className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input name="q" defaultValue={q} placeholder="Buscar arquivo pelo nome" className="input pl-9" />
        </div>
        <select name="projeto" defaultValue={searchParams.projeto ?? ""} className="input sm:w-72">
          <option value="">Todos os projetos</option>
          {projetos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.codigo} · {p.nome}
            </option>
          ))}
        </select>
        <button className="btn-secundario">Filtrar</button>
      </form>

      <section className="card">
        {linhas.length === 0 ? (
          <Vazio icone={<Files className="h-8 w-8" />} titulo="Nenhum arquivo encontrado" />
        ) : (
          <TabelaArquivos arquivos={linhas} mostrarProjeto mostrarNivel={!gestor} />
        )}
      </section>
    </>
  );
}
