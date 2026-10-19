import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, Mail, Phone, User } from "lucide-react";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { progresso } from "@/lib/consultas";
import { chamadoAberto, situacaoSla } from "@/lib/sla";
import { dataParaInput, fmtData, fmtMoeda, tempoRelativo } from "@/lib/utils";
import {
  Cabecalho,
  Kpi,
  Progresso,
  ROTULO_TIPO_CONTRATO,
  SlaBadge,
  StatusChamadoBadge,
  StatusContratoBadge,
  StatusProjetoBadge,
  TipoProjetoBadge,
  TituloCard,
  Vazio,
} from "@/components/ui";
import { EditarCliente, FormContrato } from "../cliente";

export default async function ClientePage({ params }: { params: { id: string } }) {
  await exigirGestor();
  const c = await db.cliente.findUnique({
    where: { id: params.id },
    include: {
      contratos: { include: { projeto: { select: { codigo: true } } }, orderBy: [{ status: "asc" }, { inicio: "desc" }] },
      projetos: { include: { etapas: { select: { status: true } } }, orderBy: [{ status: "asc" }, { criadoEm: "desc" }] },
      chamados: { orderBy: { criadoEm: "desc" }, take: 15 },
    },
  });
  if (!c) notFound();
  const projetosOpcoes = await db.projeto.findMany({ select: { id: true, codigo: true, nome: true }, orderBy: { codigo: "desc" } });

  const horas = await db.apontamento.aggregate({
    where: { projeto: { clienteId: c.id }, data: { gte: new Date(Date.now() - 30 * 86400000) } },
    _sum: { minutos: true },
  });
  const recorrente = c.contratos.filter((x) => x.status === "ATIVO" && x.tipo !== "PROJETO").reduce((s, x) => s + x.valorCentavos, 0);
  const horasContratadas = c.contratos.filter((x) => x.status === "ATIVO").reduce((s, x) => s + (x.horasMes ?? 0), 0);
  const horas30 = Math.round((horas._sum.minutos ?? 0) / 60);

  return (
    <>
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-100">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>
      <Cabecalho
        eyebrow={c.documento ?? "Cliente"}
        titulo={c.nome}
        descricao={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {c.razaoSocial && <span>{c.razaoSocial}</span>}
            {c.contatoNome && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> {c.contatoNome}
              </span>
            )}
            {c.telefone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {c.telefone}
              </span>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-neon">
                <Mail className="h-3.5 w-3.5" /> {c.email}
              </a>
            )}
            {c.site && (
              <a href={/^https?:/.test(c.site) ? c.site : `https://${c.site}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-neon">
                <Globe className="h-3.5 w-3.5" /> {c.site.replace(/^https?:\/\//, "")}
              </a>
            )}
          </span>
        }
        acoes={<EditarCliente id={c.id} cliente={c} />}
      />
      {c.observacoes && <p className="-mt-2 mb-6 max-w-3xl whitespace-pre-line text-sm text-ink-300">{c.observacoes}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Recorrente/mês" valor={fmtMoeda(recorrente)} destaque={recorrente > 0} />
        <Kpi
          rotulo="Horas (30 dias)"
          valor={`${horas30}h`}
          detalhe={horasContratadas ? <span className={horas30 > horasContratadas ? "text-red-300" : ""}>de {horasContratadas}h contratadas/mês</span> : "sem banco de horas"}
        />
        <Kpi rotulo="Projetos" valor={c.projetos.length} detalhe={`${c.projetos.filter((p) => p.status === "ATIVO").length} ativo(s)`} />
        <Kpi rotulo="Chamados abertos" valor={c.chamados.filter(chamadoAberto).length} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card xl:col-span-2">
          <TituloCard titulo="Contratos" acao={<FormContrato clienteId={c.id} projetos={projetosOpcoes} />} />
          {c.contratos.length === 0 ? (
            <Vazio titulo="Nenhum contrato" texto="Cadastre o contrato para calcular MRR e o SLA dos chamados." />
          ) : (
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Contrato</th>
                    <th>Tipo</th>
                    <th className="text-right">Valor</th>
                    <th>Vigência</th>
                    <th>SLA</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {c.contratos.map((x) => (
                    <tr key={x.id}>
                      <td>
                        <div className="font-medium text-ink-100">{x.titulo}</div>
                        {x.projeto && <div className="font-mono text-xs text-ink-400">{x.projeto.codigo}</div>}
                      </td>
                      <td className="text-sm text-ink-300">{ROTULO_TIPO_CONTRATO[x.tipo]}</td>
                      <td className="text-right font-mono tabular-nums">
                        {fmtMoeda(x.valorCentavos)}
                        {x.tipo !== "PROJETO" && <span className="text-xs text-ink-400">/mês</span>}
                      </td>
                      <td className="whitespace-nowrap text-xs text-ink-400">
                        {fmtData(x.inicio)} → {x.fim ? fmtData(x.fim) : "indeterminado"}
                        {x.diaVencimento && <div>vence dia {x.diaVencimento}</div>}
                      </td>
                      <td className="text-xs text-ink-400">{x.slaRespostaHoras || x.slaSolucaoHoras ? `${x.slaRespostaHoras ?? "—"}h / ${x.slaSolucaoHoras ?? "—"}h` : "padrão"}</td>
                      <td>
                        <StatusContratoBadge status={x.status} />
                      </td>
                      <td className="text-right">
                        <FormContrato
                          clienteId={c.id}
                          projetos={projetosOpcoes}
                          contrato={{
                            id: x.id,
                            titulo: x.titulo,
                            tipo: x.tipo,
                            status: x.status,
                            valor: (x.valorCentavos / 100).toFixed(2).replace(".", ","),
                            diaVencimento: x.diaVencimento,
                            horasMes: x.horasMes,
                            slaRespostaHoras: x.slaRespostaHoras,
                            slaSolucaoHoras: x.slaSolucaoHoras,
                            inicio: dataParaInput(x.inicio),
                            fim: dataParaInput(x.fim),
                            projetoId: x.projetoId,
                            observacoes: x.observacoes,
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <TituloCard
            titulo="Projetos"
            acao={
              <Link href={`/projetos/novo?cliente=${c.id}`} className="btn-secundario btn-sm">
                Novo projeto
              </Link>
            }
          />
          {c.projetos.length === 0 ? (
            <Vazio titulo="Nenhum projeto" />
          ) : (
            <ul className="divide-y divide-ink-800">
              {c.projetos.map((p) => (
                <li key={p.id}>
                  <Link href={`/projetos/${p.id}`} className="block px-5 py-3 hover:bg-ink-800/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink-100">
                        <span className="mr-2 font-mono text-xs text-ink-400">{p.codigo}</span>
                        {p.nome}
                      </span>
                      <span className="flex shrink-0 gap-1.5">
                        <TipoProjetoBadge tipo={p.tipo} />
                        <StatusProjetoBadge status={p.status} />
                      </span>
                    </div>
                    <Progresso valor={progresso(p.etapas)} className="mt-2" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <TituloCard
            titulo="Chamados recentes"
            acao={
              <Link href={`/chamados?cliente=${c.id}`} className="text-xs font-semibold text-ink-400 hover:text-neon">
                Todos
              </Link>
            }
          />
          {c.chamados.length === 0 ? (
            <Vazio titulo="Nenhum chamado" />
          ) : (
            <ul className="divide-y divide-ink-800">
              {c.chamados.map((x) => (
                <li key={x.id}>
                  <Link href={`/chamados/${x.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-ink-800/50">
                    <span className="font-mono text-xs text-ink-400">#{x.numero}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-100">{x.titulo}</span>
                    <SlaBadge sla={situacaoSla(x)} />
                    <StatusChamadoBadge status={x.status} />
                    <span className="hidden text-[11px] text-ink-500 sm:inline">{tempoRelativo(x.criadoEm)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
