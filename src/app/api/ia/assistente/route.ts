import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { usuarioAtual } from "@/lib/auth";
import { iaConfigurada } from "@/lib/ia/levantamento";
import { perguntarAssistente } from "@/lib/ia/assistente";

export const runtime = "nodejs";
export const maxDuration = 120;

const Corpo = z.object({
  pergunta: z.string().min(1).max(2000),
  historico: z.array(z.object({ papel: z.enum(["usuario", "assistente"]), texto: z.string().max(8000) })).max(30).default([]),
});

export async function POST(req: Request) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ erro: "Sessão expirada. Entre novamente." }, { status: 401 });
  if (!iaConfigurada()) {
    return NextResponse.json({ erro: "A IA ainda não foi ativada: o gestor precisa definir ANTHROPIC_API_KEY no servidor." }, { status: 503 });
  }
  const r = Corpo.safeParse(await req.json().catch(() => null));
  if (!r.success) return NextResponse.json({ erro: "Pergunta inválida." }, { status: 400 });

  try {
    const resposta = await perguntarAssistente(u, r.data.historico, r.data.pergunta.trim());
    return NextResponse.json(resposta);
  } catch (e) {
    console.error("[ia] assistente", e);
    const msg =
      e instanceof Anthropic.RateLimitError
        ? "Muitas perguntas seguidas. Aguarde um minuto e tente de novo."
        : e instanceof Anthropic.AuthenticationError
          ? "Chave da IA inválida. Avise o gestor."
          : e instanceof Anthropic.APIError
            ? `A IA está indisponível agora (${e.status}). Tente de novo em instantes.`
            : "Não foi possível responder agora.";
    return NextResponse.json({ erro: msg }, { status: 502 });
  }
}
