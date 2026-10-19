import Link from "next/link";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { etapaAtrasada } from "@/lib/consultas";
import { cn, estaOnline, tempoRelativo } from "@/lib/utils";
import { Avatar, Badge, Cabecalho } from "@/components/ui";
import { BotaoAtivo, FormUsuario } from "./cliente";
import { formatarTelefone } from "@/lib/whatsapp";

export const metadata = { title: "Equipe" };

export default async function Equipe() {
  const eu = await exigirGestor();
  const usuarios = await db.usuario.findMany({
    include: { etapas: { where: { projeto: { status: "ATIVO" } }, select: { status: true, prazo: true } } },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });
  const online = usuarios.filter((x) => x.ativo && estaOnline(x.ultimoAcesso));

  return (
    <>
      <Cabecalho
        eyebrow="Equipe"
        titulo="Equipe e acessos"
        descricao={`${usuarios.filter((x) => x.ativo).length} pessoas ativas · ${online.length} online agora`}
        acoes={<FormUsuario />}
      />

      <section className="card">
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Perfil</th>
                <th className="text-center">Etapas abertas</th>
                <th className="text-center">Atrasadas</th>
                <th>Último acesso</th>
                <th className="text-right">Acesso</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((x) => {
                const abertas = x.etapas.filter((e) => e.status !== "CONCLUIDA").length;
                const atr = x.etapas.filter(etapaAtrasada).length;
                return (
                  <tr key={x.id} className={cn(!x.ativo && "opacity-50")}>
                    <td>
                      <Link href={`/equipe/${x.id}`} className="flex items-center gap-3 hover:text-neon">
                        <Avatar nome={x.nome} online={x.ativo ? x.ultimoAcesso : false} />
                        <span className="min-w-0">
                          <span className="block font-medium">{x.nome}</span>
                          <span className="block truncate text-xs text-ink-400">
                            {x.email}
                            {x.cargo && ` · ${x.cargo}`}
                            {x.telefone && ` · ${formatarTelefone(x.telefone)}`}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td>{x.perfil === "GESTOR" ? <Badge tom="roxo">Gestor</Badge> : <Badge>Colaborador</Badge>}</td>
                    <td className="text-center tabular-nums">{abertas}</td>
                    <td className="text-center tabular-nums">{atr ? <span className="text-red-300">{atr}</span> : 0}</td>
                    <td className="whitespace-nowrap text-xs">
                      {x.ativo && estaOnline(x.ultimoAcesso) ? <span className="font-semibold text-neon">● online</span> : <span className="text-ink-400">{tempoRelativo(x.ultimoAcesso)}</span>}
                    </td>
                    <td className="text-right">
                      {x.id === eu.id ? <span className="text-xs text-ink-500">você</span> : <BotaoAtivo id={x.id} ativo={x.ativo} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <p className="mt-4 text-xs text-ink-500">
        Desativar uma pessoa encerra a sessão dela imediatamente e bloqueia o acesso a todos os arquivos. O histórico é mantido.
      </p>
    </>
  );
}
