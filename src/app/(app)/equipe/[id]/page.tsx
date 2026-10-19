import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { etapaAtrasada, ROTULO_ACAO } from "@/lib/consultas";
import { estaOnline, fmtData, fmtDataHora, fmtRevisao, tempoRelativo } from "@/lib/utils";
import { Avatar, Badge, Cabecalho, Kpi, PrazoBadge, StatusEtapaBadge, Vazio } from "@/components/ui";
import { BotaoAtivo, EditarUsuario } from "../cliente";
import { FormMissaoEModelo } from "./missao";
import { formatarTelefone } from "@/lib/whatsapp";

export default async function Pessoa({ params }: { params: { id: string } }) {
  const eu = await exigirGestor();
  const p = await db.usuario.findUnique({
    where: { id: params.id },
    include: {
      etapas: { include: { projeto: { select: { id: true, codigo: true, nome: true, status: true } } }, orderBy: [{ status: "asc" }, { prazo: "asc" }] },
    },
  });
  if (!p) notFound();

  const logs = await db.logAcesso.findMany({
    where: { usuarioId: p.id },
    include: { arquivo: { select: { id: true, nome: true } }, versao: { select: { revisao: true } } },
    orderBy: { criadoEm: "desc" },
    take: 40,
  });
  const ativas = p.etapas.filter((e) => e.projeto.status === "ATIVO");
  const trintaDias = new Date(Date.now() - 30 * 86400000);

  return (
    <>
      <Link href="/equipe" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-100">
        <ArrowLeft className="h-4 w-4" /> Equipe
      </Link>
      <Cabecalho
        eyebrow={p.perfil === "GESTOR" ? "Gestor" : "Colaborador"}
        titulo={
          <span className="flex items-center gap-4">
            <Avatar nome={p.nome} online={p.ativo ? p.ultimoAcesso : false} tamanho="lg" /> {p.nome}
          </span>
        }
        descricao={
          <>
            {p.email}
            {p.cargo && ` · ${p.cargo}`}
            {p.telefone && ` · WhatsApp ${formatarTelefone(p.telefone)}`} · {p.ativo ? (estaOnline(p.ultimoAcesso) ? "online agora" : `último acesso ${tempoRelativo(p.ultimoAcesso)}`) : "desativado"}
          </>
        }
        acoes={
          <>
            <EditarUsuario usuario={{ id: p.id, nome: p.nome, email: p.email, cargo: p.cargo, telefone: p.telefone, perfil: p.perfil }} />
            {p.id !== eu.id && <BotaoAtivo id={p.id} ativo={p.ativo} />}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Em aberto" valor={ativas.filter((e) => e.status !== "CONCLUIDA").length} />
        <Kpi rotulo="Atrasadas" valor={ativas.filter(etapaAtrasada).length} />
        <Kpi rotulo="Concluídas (30 dias)" valor={p.etapas.filter((e) => e.concluidaEm && e.concluidaEm > trintaDias).length} />
        <Kpi rotulo="Downloads (30 dias)" valor={logs.filter((l) => l.acao === "BAIXOU" && l.criadoEm > trintaDias).length} />
      </div>

      <section className="card mt-6 p-5 sm:p-6">
        <FormMissaoEModelo id={p.id} nome={p.nome} gestor={eu.nome} missao={p.missao} modelo={p.modeloWhatsapp} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card">
          <div className="border-b border-ink-700 px-5 py-4">
            <h2 className="font-semibold text-white">Etapas</h2>
          </div>
          {p.etapas.length === 0 ? (
            <Vazio titulo="Nenhuma etapa designada" />
          ) : (
            <ul className="divide-y divide-ink-800">
              {p.etapas.map((e) => (
                <li key={e.id}>
                  <Link href={`/projetos/${e.projeto.id}/etapas/${e.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-800/40">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink-100">{e.nome}</div>
                      <div className="text-xs text-ink-400">
                        {e.projeto.codigo} · {e.projeto.nome} · prazo {fmtData(e.prazo)}
                      </div>
                    </div>
                    <PrazoBadge prazo={e.prazo} concluida={e.status === "CONCLUIDA"} />
                    <StatusEtapaBadge status={e.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
            <h2 className="font-semibold text-white">Atividade recente</h2>
            <Link href={`/auditoria?usuario=${p.id}`} className="text-xs font-semibold text-ink-400 hover:text-neon">
              Auditoria completa
            </Link>
          </div>
          {logs.length === 0 ? (
            <Vazio titulo="Sem atividade registrada" />
          ) : (
            <ul className="divide-y divide-ink-800">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <Badge tom={l.acao === "BAIXOU" ? "verde" : l.acao.includes("NEGADO") || l.acao.includes("FALHOU") ? "vermelho" : l.acao === "VISUALIZOU" ? "azul" : "neutro"}>
                    {ROTULO_ACAO[l.acao]}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-ink-300">
                    {l.arquivo ? (
                      <Link href={`/arquivos/${l.arquivo.id}`} className="hover:text-neon">
                        {l.arquivo.nome} {l.versao && fmtRevisao(l.versao.revisao)}
                      </Link>
                    ) : (
                      l.detalhe
                    )}
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-500">{fmtDataHora(l.criadoEm)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
