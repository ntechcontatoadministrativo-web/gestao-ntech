import { Sparkles } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { iaConfigurada } from "@/lib/ia/levantamento";
import { sugestoesAssistente } from "@/lib/consultas";
import { Aviso, Cabecalho } from "@/components/ui";
import { Chat } from "@/components/assistente";

export const metadata = { title: "Assistente IA" };

export default async function Assistente() {
  const u = await exigirUsuario();
  const sugestoes = await sugestoesAssistente(u);
  return (
    <>
      <Cabecalho
        eyebrow="Inteligência"
        titulo={
          <span className="flex items-center gap-3">
            <Sparkles className="h-7 w-7 text-neon" /> Assistente
          </span>
        }
        descricao={
          u.perfil === "GESTOR"
            ? "Pergunte o que cada pessoa fez, como estão os projetos, o que está atrasado, quantas horas foram gastas…"
            : "Pergunte sobre as suas etapas, tarefas e horas."
        }
      />
      {!iaConfigurada() && (
        <div className="mb-4">
          <Aviso tom="alerta">A IA ainda não foi ativada: é preciso definir ANTHROPIC_API_KEY no servidor.</Aviso>
        </div>
      )}
      <section className="card flex h-[calc(100vh-15rem)] min-h-[480px] flex-col overflow-hidden">
        <Chat sugestoes={sugestoes} />
      </section>
    </>
  );
}
