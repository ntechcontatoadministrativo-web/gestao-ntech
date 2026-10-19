import "server-only";
import type { NivelAcesso, Prisma } from "@prisma/client";
import { db } from "./db";
import type { UsuarioSessao } from "./auth";

export type NivelEfetivo = "BAIXAR" | "VISUALIZAR" | null;

/*
 * Regra de acesso a arquivos (a liberação individual sempre vence):
 *   1. Gestor: acesso total.
 *   2. Liberação individual do arquivo para a pessoa (BLOQUEADO = sem acesso).
 *   3. Liberação padrão da equipe do arquivo, válida para quem é responsável
 *      pela etapa do arquivo (ou por qualquer etapa do projeto, se o arquivo
 *      for do projeto).
 *   4. Caso contrário, sem acesso.
 */
export async function nivelNoArquivo(usuario: UsuarioSessao, arquivoId: string): Promise<NivelEfetivo> {
  if (usuario.perfil === "GESTOR") return "BAIXAR";

  const arquivo = await db.arquivo.findUnique({
    where: { id: arquivoId },
    select: {
      projetoId: true,
      etapaId: true,
      acessoEquipe: true,
      acessos: { where: { usuarioId: usuario.id }, select: { nivel: true } },
    },
  });
  if (!arquivo) return null;

  const individual = arquivo.acessos[0]?.nivel;
  if (individual) return individual === "BLOQUEADO" ? null : individual;

  if (!arquivo.acessoEquipe || arquivo.acessoEquipe === "BLOQUEADO") return null;
  const daEquipe = await db.etapa.count({
    where: arquivo.etapaId
      ? { id: arquivo.etapaId, responsavelId: usuario.id }
      : { projetoId: arquivo.projetoId, responsavelId: usuario.id },
  });
  return daEquipe > 0 ? arquivo.acessoEquipe : null;
}

export const podeVer = (n: NivelEfetivo) => n === "VISUALIZAR" || n === "BAIXAR";
export const podeBaixar = (n: NivelEfetivo) => n === "BAIXAR";

// Filtro Prisma dos arquivos que o colaborador enxerga.
export function filtroArquivosVisiveis(usuarioId: string): Prisma.ArquivoWhereInput {
  const liberado: NivelAcesso[] = ["VISUALIZAR", "BAIXAR"];
  return {
    OR: [
      { acessos: { some: { usuarioId, nivel: { in: liberado } } } },
      {
        acessos: { none: { usuarioId } },
        acessoEquipe: { in: liberado },
        OR: [
          { etapa: { responsavelId: usuarioId } },
          { etapaId: null, projeto: { etapas: { some: { responsavelId: usuarioId } } } },
        ],
      },
    ],
  };
}

// Calcula o nível de vários arquivos de uma vez (para listagens).
export function nivelCalculado(
  usuario: UsuarioSessao,
  arquivo: {
    etapaId: string | null;
    acessoEquipe: NivelAcesso | null;
    acessos: { usuarioId: string; nivel: NivelAcesso }[];
  },
  etapasDoUsuario: Set<string>,
  ehEquipeDoProjeto: boolean,
): NivelEfetivo {
  if (usuario.perfil === "GESTOR") return "BAIXAR";
  const ind = arquivo.acessos.find((a) => a.usuarioId === usuario.id)?.nivel;
  if (ind) return ind === "BLOQUEADO" ? null : ind;
  if (!arquivo.acessoEquipe || arquivo.acessoEquipe === "BLOQUEADO") return null;
  const daEquipe = arquivo.etapaId ? etapasDoUsuario.has(arquivo.etapaId) : ehEquipeDoProjeto;
  return daEquipe ? arquivo.acessoEquipe : null;
}

export async function podeVerProjeto(usuario: UsuarioSessao, projetoId: string) {
  if (usuario.perfil === "GESTOR") return true;
  const n = await db.etapa.count({ where: { projetoId, responsavelId: usuario.id } });
  if (n > 0) return true;
  // Quem tem item no quadro ou chamado no projeto também participa dele.
  const t = await db.tarefa.count({ where: { projetoId, responsavelId: usuario.id } });
  if (t > 0) return true;
  const c = await db.chamado.count({ where: { projetoId, responsavelId: usuario.id } });
  if (c > 0) return true;
  // Também vê o projeto quem recebeu algum arquivo liberado individualmente.
  const a = await db.arquivo.count({ where: { projetoId, ...filtroArquivosVisiveis(usuario.id) } });
  return a > 0;
}
