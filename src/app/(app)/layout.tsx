import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/shell";
import { Presenca } from "@/components/client";
import { AssistenteFlutuante } from "@/components/assistente";
import { STATUS_ABERTOS, sugestoesAssistente } from "@/lib/consultas";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  const gestor = usuario.perfil === "GESTOR";

  const [pendencias, tarefasAbertas, chamados, avisos] = await Promise.all([
    // Gestor: etapas para aprovar + itens em revisão. Colaborador: etapas dele em aberto.
    gestor
      ? Promise.all([db.etapa.count({ where: { status: "AGUARDANDO_APROVACAO" } }), db.tarefa.count({ where: { status: "REVISAO" } })]).then(([a, b]) => a + b)
      : db.etapa.count({ where: { responsavelId: usuario.id, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } } }),
    db.tarefa.count({ where: { status: { in: STATUS_ABERTOS }, ...(gestor ? {} : { responsavelId: usuario.id }) } }),
    db.chamado.count({
      where: { status: { in: ["ABERTO", "EM_ATENDIMENTO"] }, ...(gestor ? {} : { OR: [{ responsavelId: usuario.id }, { responsavelId: null }] }) },
    }),
    db.aviso.count({ where: { usuarioId: usuario.id, lidoEm: null } }),
  ]);

  return (
    <Shell usuario={usuario} pendencias={pendencias} tarefasAbertas={tarefasAbertas} chamados={chamados} avisos={avisos}>
      <Presenca />
      {children}
      <AssistenteFlutuante sugestoes={await sugestoesAssistente(usuario)} />
    </Shell>
  );
}
