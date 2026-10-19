import "server-only";
import { db } from "./db";

type Aviso = { tipo: string; titulo: string; texto?: string | null; link?: string | null };

// Cria avisos no sininho. Nunca derruba a ação principal se falhar,
// e não avisa a própria pessoa que fez a ação.
export async function avisar(destinatarios: (string | null | undefined)[], aviso: Aviso, autorId?: string | null) {
  const ids = Array.from(new Set(destinatarios.filter((d): d is string => !!d && d !== autorId)));
  if (!ids.length) return;
  try {
    await db.aviso.createMany({
      data: ids.map((usuarioId) => ({
        usuarioId,
        tipo: aviso.tipo,
        titulo: aviso.titulo.slice(0, 200),
        texto: aviso.texto?.slice(0, 500) ?? null,
        link: aviso.link ?? null,
      })),
    });
  } catch (e) {
    console.error("[avisos]", e);
  }
}

export async function idsGestores() {
  return (await db.usuario.findMany({ where: { perfil: "GESTOR", ativo: true }, select: { id: true } })).map((u) => u.id);
}
