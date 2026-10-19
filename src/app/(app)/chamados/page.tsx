import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import type { Prisma, StatusChamado } from "@prisma/client";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { situacaoSla } from "@/lib/sla";
import { cn, tempoRelativo } from "@/lib/utils";
import { Avatar, Cabecalho, Kpi, PrioridadeBadge, SlaBadge, StatusChamadoBadge, Vazio } from "@/components/ui";
import { SelectAuto } from "@/components/client";
import { NovoChamado } from "./cliente";
import { opcoesChamado } from "./opcoes";

export const metadata = { title: "Chamados" };

const FILTROS = [
  { v: "abertos", rotulo: "Em aberto" },
  { v: "fila", rotulo: "Fila sem dono" },
  { v: "meus", rotulo: "Comigo" },
  { v: "AGUARDANDO_CLIENTE", rotulo: "Aguardando cliente" },
  { v: "resolvidos", rotulo: "Resolvidos" },
  { v: "todos", rotulo: "Todos" },
] as const;
const ABERTOS: StatusChamado[] = ["ABERTO", "EM_ATENDIMENTO", "AGUARDANDO_CLIENTE"];

export default async function Chamados({ searchParams }: { searchParams: { f?: string; cliente?: string; projeto?: string } }) {
  const u = await exigirUsuario();
  const f = FILTROS.some((x) => x.v === searchParams.f) ? searchParams.f! : "abertos";
  const where: Prisma.ChamadoWhereInput = {
    ...(searchParams.cliente ? { clienteId: searchParams.cliente } : {}),
    ...(searchParams.projeto ? { projetoId: searchParams.projeto } : {}),
    ...(f === "abertos"
      ? { status: { in: ABERTOS } }
      : f === "fila"
        ? { status: { in: ABERTOS }, responsavelId: null }
        : f === "meus"
          ? { status: { in: ABERTOS }, responsavelId: u.id }
          : f === "resolvidos"
            ? { status: { in: ["RESOLVIDO", "FECHADO"] } }
            : f === "todos"
              ? {}
              : { status: f as StatusChamado }),
  };

  const [chamados, opcoes, abertos, resolvidos30] = await Promise.all([
    db.chamado.findMany({
      where,
      include: { cliente: { select: { nome: true } }, projeto: { select: { codigo: true } }, responsavel: { select: { nome: true, ultimoAcesso: true } } },
      orderBy: { criadoEm: "desc" },
      take: 200,
    }),
    opcoesChamado(),
    db.chamado.findMany({ where: { status: { in: ABERTOS } }, select: { status: true, prazoResposta: true, prazoSolucao: true, primeiraRespostaEm: true, criadoEm: true, responsavelId: true } }),
    db.chamado.findMany({
      where: { resolvidoEm: { gte: new Date(Date.now() - 30 * 86400000) } },
      select: { criadoEm: true, resolvidoEm: true, prazoSolucao: true },
    }),
  ]);

  // Ordem: SLA estourado primeiro, depois o que vence antes.
  const peso = { estourado: 0, alerta: 1, ok: 2 } as const;
  const comSla = chamados.map((c) => ({ ...c, sla: situacaoSla(c) }));
  if (f !== "resolvidos" && f !== "todos") comSla.sort((a, b) => (a.sla ? peso[a.sla.nivel] : 3) - (b.sla ? peso[b.sla.nivel] : 3) || (a.prazoSolucao?.getTime() ?? 0) - (b.prazoSolucao?.getTime() ?? 0));

  const estourados = abertos.filter((c) => situacaoSla(c)?.nivel === "estourado").length;
  const noPrazo = resolvidos30.filter((c) => c.prazoSolucao && c.resolvidoEm! <= c.prazoSolucao).length;
  const tempoMedio = resolvidos30.length ? resolvidos30.reduce((s, c) => s + (c.resolvidoEm!.getTime() - c.criadoEm.getTime()), 0) / resolvidos30.length / 3600000 : 0;

  const qs = (x: Record<string, string>) => new URLSearchParams({ ...(searchParams.cliente ? { cliente: searchParams.cliente } : {}), ...(searchParams.projeto ? { projeto: searchParams.projeto } : {}), f, ...x }).toString();

  return (
    <>
      <Cabecalho
        eyebrow="Suporte"
        titulo="Chamados"
        descricao="Pedidos de suporte dos clientes, com prazo de resposta e solução (SLA)."
        acoes={<NovoChamado opcoes={opcoes} padrao={searchParams.cliente ? { clienteId: searchParams.cliente } : undefined} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Em aberto" valor={abertos.length} detalhe={`${abertos.filter((c) => !c.responsavelId).length} na fila sem dono`} />
        <Kpi rotulo="SLA estourado" valor={<span className={estourados ? "text-red-300" : ""}>{estourados}</span>} destaque={estourados === 0 && abertos.length > 0} />
        <Kpi rotulo="Resolvidos (30d)" valor={resolvidos30.length} detalhe={resolvidos30.length ? `${Math.round((noPrazo / resolvidos30.length) * 100)}% dentro do SLA` : undefined} />
        <Kpi rotulo="Tempo médio de solução" valor={resolvidos30.length ? (tempoMedio < 48 ? `${tempoMedio.toFixed(1)}h` : `${(tempoMedio / 24).toFixed(1)}d`) : "—"} detalhe="últimos 30 dias" />
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((x) => (
            <Link
              key={x.v}
              href={`/chamados?${qs({ f: x.v })}`}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", f === x.v ? "bg-neon text-ink-950" : "bg-ink-800 text-ink-300 hover:bg-ink-700")}
            >
              {x.rotulo}
            </Link>
          ))}
        </div>
        <form>
          <input type="hidden" name="f" value={f} />
          <SelectAuto name="cliente" defaultValue={searchParams.cliente ?? ""} className="input py-2 md:w-60">
            <option value="">Todos os clientes</option>
            {opcoes.clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </SelectAuto>
        </form>
      </div>

      {comSla.length === 0 ? (
        <div className="card">
          <Vazio icone={<LifeBuoy className="h-8 w-8" />} titulo="Nenhum chamado aqui" texto="Registre os pedidos que chegam pelo WhatsApp, e-mail ou telefone." />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>#</th>
                <th>Assunto</th>
                <th>Cliente</th>
                <th>Prioridade</th>
                <th>SLA</th>
                <th>Responsável</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {comSla.map((c) => (
                <tr key={c.id} className={cn("hover:bg-ink-800/40", c.sla?.nivel === "estourado" && "bg-red-500/[0.04]")}>
                  <td className="font-mono text-xs text-ink-400">{c.numero}</td>
                  <td className="max-w-[340px]">
                    <Link href={`/chamados/${c.id}`} className="block truncate font-medium text-ink-100 hover:text-neon">
                      {c.titulo}
                    </Link>
                    <div className="text-[11px] text-ink-500">
                      {c.projeto?.codigo && `${c.projeto.codigo} · `}
                      {c.canal} · {tempoRelativo(c.criadoEm)}
                    </div>
                  </td>
                  <td className="text-sm text-ink-300">{c.cliente?.nome ?? "—"}</td>
                  <td>
                    <PrioridadeBadge prioridade={c.prioridade} />
                  </td>
                  <td>
                    <SlaBadge sla={c.sla} />
                  </td>
                  <td className="text-sm">
                    {c.responsavel ? (
                      <span className="inline-flex items-center gap-2">
                        <Avatar nome={c.responsavel.nome} online={c.responsavel.ultimoAcesso} tamanho="sm" /> {c.responsavel.nome.split(" ")[0]}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-300/80">fila</span>
                    )}
                  </td>
                  <td>
                    <StatusChamadoBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
