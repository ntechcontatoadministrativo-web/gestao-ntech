import Link from "next/link";
import { ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { tempoRelativo } from "@/lib/utils";
import { Aviso, Cabecalho, Vazio } from "@/components/ui";
import { FormCredencial, Segredo } from "./cliente";

export const metadata = { title: "Cofre" };

export default async function Cofre({ searchParams }: { searchParams: { q?: string } }) {
  await exigirGestor();
  const q = searchParams.q?.trim();
  const [credenciais, projetos, revelacoes] = await Promise.all([
    db.credencial.findMany({
      where: q
        ? { OR: [{ nome: { contains: q, mode: "insensitive" } }, { usuario: { contains: q, mode: "insensitive" } }, { url: { contains: q, mode: "insensitive" } }, { projeto: { codigo: { contains: q, mode: "insensitive" } } }] }
        : {},
      include: { projeto: { select: { id: true, codigo: true, nome: true } } },
      orderBy: [{ projeto: { codigo: "asc" } }, { nome: "asc" }],
    }),
    db.projeto.findMany({ select: { id: true, codigo: true, nome: true }, orderBy: { codigo: "desc" } }),
    db.logAcesso.findMany({ where: { acao: "VIU_CREDENCIAL" }, include: { usuario: { select: { nome: true } } }, orderBy: { criadoEm: "desc" }, take: 8 }),
  ]);

  return (
    <>
      <Cabecalho
        eyebrow="Engenharia"
        titulo="Cofre de credenciais"
        descricao="Acessos de clientes, hospedagens e serviços. Criptografados no banco e visíveis só para gestores."
        acoes={<FormCredencial projetos={projetos} />}
      />

      <div className="mb-5">
        <Aviso>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Cada vez que alguém revela ou copia uma senha, isso fica registrado na auditoria. A senha volta a ficar oculta depois de 30 segundos.
          </span>
        </Aviso>
      </div>

      <form className="mb-4 md:w-80">
        <input name="q" defaultValue={q} placeholder="Buscar por nome, usuário ou URL" className="input" />
      </form>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card overflow-x-auto xl:col-span-2">
          {credenciais.length === 0 ? (
            <Vazio icone={<KeyRound className="h-8 w-8" />} titulo="Cofre vazio" texto="Guarde aqui as senhas que hoje estão espalhadas em planilhas e conversas." />
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Credencial</th>
                  <th>Usuário</th>
                  <th>Senha</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {credenciais.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="flex items-center gap-2 font-medium text-ink-100">
                        {c.nome}
                        {c.url && (
                          <a href={c.url} target="_blank" rel="noreferrer" className="text-ink-400 hover:text-neon" aria-label="Abrir">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-ink-400">
                        {c.projeto ? (
                          <Link href={`/projetos/${c.projeto.id}`} className="font-mono hover:text-neon">
                            {c.projeto.codigo}
                          </Link>
                        ) : (
                          "Geral"
                        )}
                        {c.observacoes && ` · ${c.observacoes}`}
                      </div>
                    </td>
                    <td className="font-mono text-xs text-ink-300">{c.usuario ?? "—"}</td>
                    <td>
                      <Segredo id={c.id} />
                    </td>
                    <td className="text-right">
                      <FormCredencial projetos={projetos} credencial={{ id: c.id, nome: c.nome, projetoId: c.projetoId, url: c.url, usuario: c.usuario, observacoes: c.observacoes }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <div className="border-b border-ink-700 px-5 py-4">
            <h2 className="font-semibold text-white">Últimas revelações</h2>
          </div>
          {revelacoes.length === 0 ? (
            <Vazio titulo="Nenhuma ainda" />
          ) : (
            <ul className="divide-y divide-ink-800">
              {revelacoes.map((r) => (
                <li key={r.id} className="px-5 py-3 text-sm">
                  <span className="font-medium text-ink-100">{r.usuario?.nome.split(" ")[0] ?? "—"}</span> <span className="text-ink-400">viu</span> {r.detalhe}
                  <div className="text-[11px] text-ink-500">
                    {tempoRelativo(r.criadoEm)} · {r.ip ?? "ip desconhecido"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
