import type { Chamado, Prioridade } from "@prisma/client";

// SLA padrão em horas corridas (resposta, solução). Um contrato pode sobrescrever.
export const SLA_PADRAO: Record<Prioridade, { resposta: number; solucao: number }> = {
  URGENTE: { resposta: 1, solucao: 8 },
  ALTA: { resposta: 4, solucao: 24 },
  MEDIA: { resposta: 8, solucao: 72 },
  BAIXA: { resposta: 24, solucao: 168 },
};

export function prazosSla(
  prioridade: Prioridade,
  inicio: Date,
  contrato?: { slaRespostaHoras: number | null; slaSolucaoHoras: number | null } | null,
) {
  const p = SLA_PADRAO[prioridade];
  // O contrato define o SLA da prioridade MÉDIA; as outras escalam na mesma proporção.
  const fator = (base: number | null | undefined, padraoMedia: number) => (base ? base / padraoMedia : 1);
  const resposta = Math.max(0.5, p.resposta * fator(contrato?.slaRespostaHoras, SLA_PADRAO.MEDIA.resposta));
  const solucao = Math.max(1, p.solucao * fator(contrato?.slaSolucaoHoras, SLA_PADRAO.MEDIA.solucao));
  return {
    prazoResposta: new Date(inicio.getTime() + resposta * 3600_000),
    prazoSolucao: new Date(inicio.getTime() + solucao * 3600_000),
  };
}

export const chamadoAberto = (c: Pick<Chamado, "status">) => c.status === "ABERTO" || c.status === "EM_ATENDIMENTO" || c.status === "AGUARDANDO_CLIENTE";

// Situação do SLA agora: estourado, perto de estourar (< 25% do tempo) ou ok.
export function situacaoSla(c: Pick<Chamado, "status" | "prazoResposta" | "prazoSolucao" | "primeiraRespostaEm" | "criadoEm">) {
  if (!chamadoAberto(c)) return null;
  // Aguardando o cliente: o relógio da solução não conta contra a equipe.
  const alvo = !c.primeiraRespostaEm ? c.prazoResposta : c.status === "AGUARDANDO_CLIENTE" ? null : c.prazoSolucao;
  if (!alvo) return null;
  const tipo = !c.primeiraRespostaEm ? "resposta" : "solução";
  const restante = alvo.getTime() - Date.now();
  if (restante < 0) return { nivel: "estourado" as const, tipo, minutos: Math.round(-restante / 60000) };
  const total = alvo.getTime() - c.criadoEm.getTime();
  return { nivel: restante < total * 0.25 ? ("alerta" as const) : ("ok" as const), tipo, minutos: Math.round(restante / 60000) };
}

export function fmtDuracao(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}`;
  return `${Math.round(h / 24)} dias`;
}
