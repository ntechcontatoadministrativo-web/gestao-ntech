import "server-only";
import type { AcaoLog, Etapa, Prisma, StatusTarefa } from "@prisma/client";
import { hojeInicio, parseDataInput } from "./utils";
import { db } from "./db";

// Tarefas "na mão" de alguém (o backlog ainda não foi puxado para o trabalho).
export const STATUS_ABERTOS: StatusTarefa[] = ["A_FAZER", "FAZENDO", "REVISAO"];
export const tarefaAberta = (t: { status: StatusTarefa }) => STATUS_ABERTOS.includes(t.status);

export function progresso(etapas: Pick<Etapa, "status">[]) {
  if (!etapas.length) return 0;
  // Etapa aguardando aprovação conta como 75% feita; em andamento, 40%.
  const peso = { PENDENTE: 0, EM_ANDAMENTO: 0.4, AGUARDANDO_APROVACAO: 0.75, CONCLUIDA: 1 } as const;
  return Math.round((etapas.reduce((s, e) => s + peso[e.status], 0) / etapas.length) * 100);
}

export const etapaAtrasada = (e: Pick<Etapa, "status" | "prazo">) =>
  e.status !== "CONCLUIDA" && !!e.prazo && e.prazo < hojeInicio();

export function etapaAtual<T extends Pick<Etapa, "status" | "ordem">>(etapas: T[]) {
  return [...etapas].sort((a, b) => a.ordem - b.ordem).find((e) => e.status !== "CONCLUIDA") ?? null;
}

export const ROTULO_ACAO: Record<string, string> = {
  LOGIN: "Entrou no sistema",
  LOGIN_FALHOU: "Falha de login",
  VISUALIZOU: "Visualizou",
  BAIXOU: "Baixou",
  ENVIOU: "Enviou",
  NOVA_REVISAO: "Nova revisão",
  ACESSO_NEGADO: "Acesso negado",
  LIBEROU: "Liberou acesso",
  BLOQUEOU: "Bloqueou acesso",
  REMOVEU_ACESSO: "Removeu liberação",
  EXCLUIU: "Excluiu arquivo",
  VIU_CREDENCIAL: "Revelou credencial",
};

// Filtros da tela de auditoria (datas no fuso de Belém).
export function filtroAuditoria(sp: Record<string, string | undefined>): Prisma.LogAcessoWhereInput {
  const de = parseDataInput(sp.de ?? null);
  const ate = parseDataInput(sp.ate ?? null);
  return {
    ...(sp.usuario ? { usuarioId: sp.usuario } : {}),
    ...(sp.acao && sp.acao in ROTULO_ACAO ? { acao: sp.acao as AcaoLog } : {}),
    ...(sp.arquivo ? { arquivoId: sp.arquivo } : {}),
    ...(de || ate
      ? {
          criadoEm: {
            ...(de ? { gte: new Date(de.getTime() - 12 * 3600 * 1000) } : {}),
            ...(ate ? { lt: new Date(ate.getTime() + 12 * 3600 * 1000) } : {}),
          },
        }
      : {}),
  };
}


export type OpcoesTarefa = {
  pessoas: { id: string; nome: string }[];
  projetos: {
    id: string;
    codigo: string;
    nome: string;
    etapas: { id: string; nome: string; ordem: number }[];
    sprints: { id: string; nome: string; status: string }[];
  }[];
};

// Pessoas, projetos, etapas e sprints para os formulários de tarefa.
export async function opcoesTarefa(): Promise<OpcoesTarefa> {
  const [pessoas, projetos] = await Promise.all([
    db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.projeto.findMany({
      where: { status: { in: ["ATIVO", "PAUSADO"] } },
      select: {
        id: true,
        codigo: true,
        nome: true,
        etapas: { select: { id: true, nome: true, ordem: true }, orderBy: { ordem: "asc" } },
        sprints: { where: { status: { not: "CONCLUIDA" } }, select: { id: true, nome: true, status: true }, orderBy: { inicio: "asc" } },
      },
      orderBy: { codigo: "desc" },
    }),
  ]);
  return { pessoas, projetos };
}

// Projetos, etapas e tarefas em que a pessoa pode apontar horas.
export async function opcoesHoras(u: { id: string; perfil: "GESTOR" | "COLABORADOR" }) {
  const gestor = u.perfil === "GESTOR";
  const [projetos, tarefas] = await Promise.all([
    db.projeto.findMany({
      where: {
        status: { in: ["ATIVO", "PAUSADO"] },
        ...(gestor ? {} : { OR: [{ etapas: { some: { responsavelId: u.id } } }, { tarefas: { some: { responsavelId: u.id } } }] }),
      },
      select: {
        id: true,
        codigo: true,
        nome: true,
        etapas: { where: gestor ? {} : { responsavelId: u.id }, select: { id: true, nome: true, ordem: true }, orderBy: { ordem: "asc" } },
      },
      orderBy: { codigo: "desc" },
    }),
    db.tarefa.findMany({
      where: { responsavelId: u.id, status: { in: STATUS_ABERTOS }, projetoId: { not: null } },
      select: { id: true, titulo: true, projetoId: true },
      orderBy: { criadoEm: "desc" },
    }),
  ]);
  return { projetos, tarefas };
}

// Perguntas de exemplo do assistente, com nomes e projetos reais da empresa.
export async function sugestoesAssistente(u: { id: string; perfil: "GESTOR" | "COLABORADOR" }) {
  if (u.perfil !== "GESTOR") {
    return ["O que eu fiz hoje?", "Quais são minhas tarefas abertas?", "Tem chamado comigo estourando SLA?", "Quantas horas apontei essa semana?"];
  }
  const [pessoa, projeto] = await Promise.all([
    db.usuario.findFirst({ where: { ativo: true, perfil: "COLABORADOR" }, orderBy: { ultimoAcesso: { sort: "desc", nulls: "last" } }, select: { nome: true } }),
    db.projeto.findFirst({ where: { status: "ATIVO" }, orderBy: { atualizadoEm: "desc" }, select: { codigo: true } }),
  ]);
  return [
    pessoa ? `O que ${pessoa.nome.split(" ")[0]} fez hoje?` : "O que a equipe fez hoje?",
    "Quais chamados estão com SLA estourado?",
    "Como está a sprint ativa?",
    projeto ? `Como está o projeto ${projeto.codigo}?` : "Quais projetos estão ativos?",
  ];
}
