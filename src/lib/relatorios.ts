import "server-only";
import { db } from "./db";
import { progresso } from "./consultas";
import { diaBelem, intervaloDia } from "./utils";

export type LinhaPessoa = {
  id: string;
  nome: string;
  cargo: string | null;
  minutos: number;
  etapasConcluidas: number;
  etapasNoPrazo: number;
  tarefasConcluidas: number;
  tarefasNoPrazo: number;
  abertasAtrasadas: number;
  envios: number;
  downloads: number;
};

// Uma entrega conta "no prazo" se foi concluída até o fim do dia do prazo.
const noPrazo = (concluida: Date | null, prazo: Date | null) => !prazo || (!!concluida && concluida.getTime() <= prazo.getTime() + 12 * 3600 * 1000);

export function periodoRelatorio(sp: { periodo?: string; de?: string; ate?: string }) {
  const valido = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const ate = valido(sp.ate) ?? diaBelem();
  const dias = ["7", "30", "90"].includes(sp.periodo ?? "") ? Number(sp.periodo) : 30;
  const de = valido(sp.de) ?? diaBelem(new Date(intervaloDia(ate)[0].getTime() - (dias - 1) * 86400000 + 12 * 3600 * 1000));
  return { de, ate, ini: intervaloDia(de)[0], fim: intervaloDia(ate)[1] };
}

export async function relatorioProdutividade(ini: Date, fim: Date) {
  const periodo = { gte: ini, lt: fim };
  const hoje = intervaloDia(diaBelem())[0];
  const [usuarios, horas, etapas, tarefas, logs, abertasEt, abertasTa, projetos] = await Promise.all([
    db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true, cargo: true }, orderBy: { nome: "asc" } }),
    db.apontamento.findMany({ where: { data: periodo }, select: { usuarioId: true, projetoId: true, etapaId: true, minutos: true } }),
    db.etapa.findMany({ where: { concluidaEm: periodo }, select: { responsavelId: true, projetoId: true, concluidaEm: true, prazo: true } }),
    db.tarefa.findMany({ where: { concluidaEm: periodo }, select: { responsavelId: true, concluidaEm: true, prazo: true } }),
    db.logAcesso.groupBy({ by: ["usuarioId", "acao"], where: { criadoEm: periodo, acao: { in: ["ENVIOU", "NOVA_REVISAO", "BAIXOU"] } }, _count: true }),
    db.etapa.groupBy({ by: ["responsavelId"], where: { status: { not: "CONCLUIDA" }, prazo: { lt: hoje }, projeto: { status: "ATIVO" } }, _count: true }),
    db.tarefa.groupBy({ by: ["responsavelId"], where: { status: { in: ["A_FAZER", "FAZENDO"] }, prazo: { lt: hoje } }, _count: true }),
    db.projeto.findMany({
      where: { OR: [{ status: "ATIVO" }, { apontamentos: { some: { data: periodo } } }] },
      select: { id: true, codigo: true, nome: true, status: true, etapas: { select: { status: true } } },
      orderBy: { codigo: "desc" },
    }),
  ]);

  const pessoas: LinhaPessoa[] = usuarios.map((u) => {
    const et = etapas.filter((e) => e.responsavelId === u.id);
    const ta = tarefas.filter((t) => t.responsavelId === u.id);
    const log = (a: string) => logs.filter((l) => l.usuarioId === u.id && l.acao === a).reduce((s, l) => s + l._count, 0);
    return {
      ...u,
      minutos: horas.filter((h) => h.usuarioId === u.id).reduce((s, h) => s + h.minutos, 0),
      etapasConcluidas: et.length,
      etapasNoPrazo: et.filter((e) => noPrazo(e.concluidaEm, e.prazo)).length,
      tarefasConcluidas: ta.length,
      tarefasNoPrazo: ta.filter((t) => noPrazo(t.concluidaEm, t.prazo)).length,
      abertasAtrasadas:
        (abertasEt.find((a) => a.responsavelId === u.id)?._count ?? 0) + (abertasTa.find((a) => a.responsavelId === u.id)?._count ?? 0),
      envios: log("ENVIOU") + log("NOVA_REVISAO"),
      downloads: log("BAIXOU"),
    };
  });

  const linhasProjetos = projetos
    .map((p) => ({
      id: p.id,
      codigo: p.codigo,
      nome: p.nome,
      status: p.status,
      progresso: progresso(p.etapas),
      minutos: horas.filter((h) => h.projetoId === p.id).reduce((s, h) => s + h.minutos, 0),
      etapasConcluidas: etapas.filter((e) => e.projetoId === p.id).length,
    }))
    .sort((a, b) => b.minutos - a.minutos);

  const totais = {
    minutos: horas.reduce((s, h) => s + h.minutos, 0),
    etapas: etapas.length,
    etapasNoPrazo: etapas.filter((e) => noPrazo(e.concluidaEm, e.prazo)).length,
    tarefas: tarefas.length,
    tarefasNoPrazo: tarefas.filter((t) => noPrazo(t.concluidaEm, t.prazo)).length,
  };
  return { pessoas, projetos: linhasProjetos, totais };
}
