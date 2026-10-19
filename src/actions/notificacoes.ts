"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirGestor } from "@/lib/auth";
import { enviarWhatsapp } from "@/lib/whatsapp-api";

// Envia pelo sistema (Z-API) o texto que o gestor revisou na prévia.
export async function enviarMensagemWhatsapp(usuarioId: string, texto: string, referencia?: string) {
  await exigirGestor();
  const pessoa = await db.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { telefone: true } });
  const r = await enviarWhatsapp({ usuarioId, telefone: pessoa.telefone, mensagem: texto.slice(0, 4000), referencia });
  if (r.ok && referencia?.startsWith("tarefa:")) {
    await db.tarefa.update({ where: { id: referencia.slice(7) }, data: { avisadoEm: new Date() } }).catch(() => {});
    revalidatePath("/tarefas");
  }
  revalidatePath("/configuracoes");
  return r;
}
