"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { iniciarSessao } from "@/lib/auth";
import { registrarLog } from "@/lib/log";
import type { EstadoForm } from "@/components/client";

const MAX_TENTATIVAS = 5;
const JANELA_MS = 15 * 60 * 1000;
// Compara mesmo quando o e-mail não existe, para não revelar quais e-mails têm conta.
const HASH_FALSO = bcrypt.hashSync("senha-inexistente", 10);

export async function entrar(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const senha = String(fd.get("senha") ?? "");
  if (!email || !senha) return { erro: "Informe e-mail e senha." };

  const falhas = await db.logAcesso.count({
    where: { acao: "LOGIN_FALHOU", detalhe: email, criadoEm: { gte: new Date(Date.now() - JANELA_MS) } },
  });
  if (falhas >= MAX_TENTATIVAS) return { erro: "Muitas tentativas. Aguarde 15 minutos e tente novamente." };

  const usuario = await db.usuario.findUnique({ where: { email } });
  const ok = usuario ? await bcrypt.compare(senha, usuario.senhaHash) : await bcrypt.compare(senha, HASH_FALSO);

  if (!usuario || !ok) {
    await registrarLog({ acao: "LOGIN_FALHOU", usuarioId: usuario?.id, detalhe: email });
    return { erro: "E-mail ou senha incorretos." };
  }
  if (!usuario.ativo) {
    await registrarLog({ acao: "LOGIN_FALHOU", usuarioId: usuario.id, detalhe: email });
    return { erro: "Seu acesso está desativado. Fale com o gestor." };
  }

  await iniciarSessao(usuario);
  await db.usuario.update({ where: { id: usuario.id }, data: { ultimoAcesso: new Date() } });
  await registrarLog({ acao: "LOGIN", usuarioId: usuario.id });
  redirect("/painel");
}
