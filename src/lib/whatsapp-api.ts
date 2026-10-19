import "server-only";
import { db } from "./db";
import { normalizarTelefone } from "./whatsapp";

// Envio automático pela Z-API (z-api.io). Sem as variáveis, o sistema segue
// funcionando com os links wa.me (o gestor envia pelo próprio WhatsApp).
export const whatsappApiAtiva = () => !!(process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN);

export async function enviarWhatsapp(dados: { usuarioId: string; telefone: string | null; mensagem: string; referencia?: string }) {
  const telefone = normalizarTelefone(dados.telefone);
  let erro: string | null = null;
  if (!whatsappApiAtiva()) erro = "API de WhatsApp não configurada.";
  else if (!telefone) erro = "Pessoa sem WhatsApp cadastrado.";
  else {
    try {
      const url = `https://api.z-api.io/instances/${encodeURIComponent(process.env.ZAPI_INSTANCE_ID!)}/token/${encodeURIComponent(process.env.ZAPI_TOKEN!)}/send-text`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.ZAPI_CLIENT_TOKEN ? { "Client-Token": process.env.ZAPI_CLIENT_TOKEN } : {}),
        },
        body: JSON.stringify({ phone: telefone, message: dados.mensagem }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) erro = `Z-API respondeu ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`;
    } catch (e) {
      erro = e instanceof Error ? e.message : "Falha de conexão com a Z-API.";
    }
  }
  await db.notificacao.create({
    data: {
      usuarioId: dados.usuarioId,
      status: erro ? "ERRO" : "ENVIADA",
      mensagem: dados.mensagem.slice(0, 4000),
      erro,
      referencia: dados.referencia ?? null,
    },
  });
  return erro ? { ok: false as const, erro } : { ok: true as const };
}
