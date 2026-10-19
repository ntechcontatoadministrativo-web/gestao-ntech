import Link from "next/link";
import { List, Timer } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { opcoesTarefa } from "@/lib/consultas";
import { whatsappApiAtiva } from "@/lib/whatsapp-api";
import { dataParaInput, diasAte, fmtData } from "@/lib/utils";
import { Cabecalho, Progresso } from "@/components/ui";
import { SelectAuto } from "@/components/client";
import { NovaTarefa } from "../tarefas/cliente";
import { Quadro, type CartaoQuadro } from "./quadro";

export const metadata = { title: "Quadro" };

export default async function QuadroPage({ searchParams }: { searchParams: { projeto?: string; sprint?: string; pessoa?: string; backlog?: string } }) {
  const u = await exigirUsuario();
  const gestor = u.perfil === "GESTOR";
  const opcoes = await opcoesTarefa();

  const projeto = opcoes.projetos.find((p) => p.id === searchParams.projeto) ?? null;
  // Com projeto escolhido e sem sprint na URL, abre a sprint ativa.
  const pedida = !projeto || searchParams.sprint === "todas" ? null : (searchParams.sprint ?? projeto.sprints.find((s) => s.status === "ATIVA")?.id ?? null);
  const encontrada = pedida
    ? await db.sprint.findUnique({ where: { id: pedida }, include: { tarefas: { select: { status: true, pontos: true } } } })
    : null;
  // Ao trocar de projeto, a sprint do projeto anterior pode vir na URL: ignora.
  const sprint = encontrada && encontrada.projetoId === projeto?.id ? encontrada : null;
  const sprintId = sprint?.id ?? null;

  const duasSemanas = new Date(Date.now() - 14 * 86400000);
  const where: Prisma.TarefaWhereInput = {
    AND: [
      projeto ? { projetoId: projeto.id } : {},
      sprint ? { sprintId: sprint.id } : {},
      searchParams.pessoa === "eu" ? { responsavelId: u.id } : searchParams.pessoa ? { responsavelId: searchParams.pessoa } : {},
      // Feitas: só as recentes (ou todas da sprint).
      sprint ? { status: { not: "CANCELADA" } } : { OR: [{ status: { in: ["BACKLOG", "A_FAZER", "FAZENDO", "REVISAO"] } }, { status: "FEITA", concluidaEm: { gte: duasSemanas } }] },
    ],
  };

  const tarefas = await db.tarefa.findMany({
    where,
    include: {
      responsavel: { select: { id: true, nome: true } },
      projeto: { select: { codigo: true } },
    },
    orderBy: [{ criadoEm: "asc" }],
    take: 500,
  });
  const ordemPrioridade = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 };
  tarefas.sort((a, b) => ordemPrioridade[a.prioridade] - ordemPrioridade[b.prioridade] || (a.prazo?.getTime() ?? Infinity) - (b.prazo?.getTime() ?? Infinity));

  const cartoes: CartaoQuadro[] = tarefas.map((t) => ({
    id: t.id,
    numero: t.numero,
    titulo: t.titulo,
    status: t.status,
    tipo: t.tipo,
    prioridade: t.prioridade,
    pontos: t.pontos,
    prazo: t.prazo ? dataParaInput(t.prazo) : null,
    atrasada: !!t.prazo && diasAte(t.prazo) < 0 && t.status !== "FEITA",
    projeto: t.projeto?.codigo ?? null,
    responsavel: t.responsavel,
    podeMover: gestor || !t.responsavelId || t.responsavelId === u.id,
  }));

  const pontosTotal = sprint?.tarefas.reduce((s, t) => s + (t.pontos ?? 0), 0) ?? 0;
  const pontosFeitos = sprint?.tarefas.filter((t) => t.status === "FEITA").reduce((s, t) => s + (t.pontos ?? 0), 0) ?? 0;

  return (
    <>
      <Cabecalho
        eyebrow="Quadro"
        titulo={projeto ? `${projeto.codigo} · ${projeto.nome}` : "Quadro da equipe"}
        descricao="Arraste os cartões entre as colunas. Quem puxa um item sem dono vira o responsável."
        acoes={
          <>
            <Link href="/tarefas" className="btn-secundario">
              <List className="h-4 w-4" /> Lista
            </Link>
            <NovaTarefa
              opcoes={opcoes}
              apiAtiva={whatsappApiAtiva()}
              gestor={gestor}
              meuId={u.id}
              padrao={projeto ? { projetoId: projeto.id, sprintId: sprint?.id ?? null } : undefined}
            />
          </>
        }
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <SelectAuto name="projeto" defaultValue={projeto?.id ?? ""} className="input w-auto py-2">
          <option value="">Todos os projetos</option>
          {opcoes.projetos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.codigo} · {p.nome}
            </option>
          ))}
        </SelectAuto>
        {projeto && (
          <SelectAuto name="sprint" defaultValue={sprintId ?? "todas"} className="input w-auto py-2">
            <option value="todas">Sem filtro de sprint</option>
            {projeto.sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
                {s.status === "ATIVA" ? " (ativa)" : ""}
              </option>
            ))}
          </SelectAuto>
        )}
        <SelectAuto name="pessoa" defaultValue={searchParams.pessoa ?? ""} className="input w-auto py-2">
          <option value="">Todas as pessoas</option>
          <option value="eu">Só os meus</option>
          {gestor &&
            opcoes.pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
        </SelectAuto>
        {searchParams.backlog === "0" && <input type="hidden" name="backlog" value="0" />}
      </form>

      {sprint && (
        <section className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon/10 text-neon">
              <Timer className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold text-white">
                {sprint.nome} <span className="ml-1 text-xs font-normal text-ink-400">{sprint.status === "ATIVA" ? "ativa" : sprint.status.toLowerCase()}</span>
              </div>
              <div className="text-xs text-ink-400">
                {fmtData(sprint.inicio)} → {fmtData(sprint.fim)}
                {sprint.status === "ATIVA" && ` · ${Math.max(0, diasAte(sprint.fim))} dia(s) restantes`}
                {sprint.objetivo && ` · ${sprint.objetivo}`}
              </div>
            </div>
          </div>
          <div className="flex-1 sm:ml-6">
            <div className="flex justify-between text-xs text-ink-400">
              <span>
                {pontosFeitos} de {pontosTotal} pontos
              </span>
              <span>{pontosTotal ? Math.round((pontosFeitos / pontosTotal) * 100) : 0}%</span>
            </div>
            <Progresso valor={pontosTotal ? (pontosFeitos / pontosTotal) * 100 : 0} className="mt-1.5 h-2" />
          </div>
        </section>
      )}

      <Quadro cartoes={cartoes} mostrarBacklog={searchParams.backlog !== "0"} />
    </>
  );
}
