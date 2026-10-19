"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { Perfil } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirGestor, exigirUsuario, iniciarSessao } from "@/lib/auth";
import type { EstadoForm } from "@/components/client";
import { normalizarTelefone } from "@/lib/whatsapp";

const texto = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v || null;
};
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
function telefoneDe(fd: FormData): { ok: string | null } | { erro: string } {
  const bruto = String(fd.get("telefone") ?? "").trim();
  if (!bruto) return { ok: null };
  const n = normalizarTelefone(bruto);
  return n ? { ok: n } : { erro: "WhatsApp inválido. Use DDD + número, ex.: (91) 98888-7777." };
}
const perfilDe = (fd: FormData): Perfil => (fd.get("perfil") === "GESTOR" ? "GESTOR" : "COLABORADOR");

export async function criarUsuario(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  await exigirGestor();
  const nome = texto(fd, "nome");
  const email = texto(fd, "email")?.toLowerCase();
  const senha = String(fd.get("senha") ?? "");
  if (!nome || !email) return { erro: "Nome e e-mail são obrigatórios." };
  if (!emailValido(email)) return { erro: "E-mail inválido." };
  if (senha.length < 8) return { erro: "A senha inicial precisa ter ao menos 8 caracteres." };
  if (await db.usuario.findUnique({ where: { email } })) return { erro: "Já existe um usuário com esse e-mail." };
  const tel = telefoneDe(fd);
  if ("erro" in tel) return tel;

  await db.usuario.create({
    data: { nome, email, telefone: tel.ok, cargo: texto(fd, "cargo"), perfil: perfilDe(fd), senhaHash: await bcrypt.hash(senha, 10) },
  });
  revalidatePath("/equipe");
  return { ok: `${nome} foi cadastrado(a).` };
}

export async function editarUsuario(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const gestor = await exigirGestor();
  const nome = texto(fd, "nome");
  const email = texto(fd, "email")?.toLowerCase();
  if (!nome || !email || !emailValido(email)) return { erro: "Nome e e-mail válidos são obrigatórios." };
  if (await db.usuario.findFirst({ where: { email, NOT: { id } } })) return { erro: "E-mail já usado por outra pessoa." };

  const perfil = perfilDe(fd);
  if (id === gestor.id && perfil !== "GESTOR") return { erro: "Você não pode remover o seu próprio perfil de gestor." };

  const senha = String(fd.get("senha") ?? "");
  if (senha && senha.length < 8) return { erro: "A nova senha precisa ter ao menos 8 caracteres." };
  const tel = telefoneDe(fd);
  if ("erro" in tel) return tel;

  await db.usuario.update({
    where: { id },
    data: {
      nome,
      email,
      cargo: texto(fd, "cargo"),
      telefone: tel.ok,
      perfil,
      ...(senha ? { senhaHash: await bcrypt.hash(senha, 10), versaoSessao: { increment: 1 } } : {}),
    },
  });
  revalidatePath("/equipe");
  revalidatePath(`/equipe/${id}`);
  return { ok: senha ? "Dados e senha atualizados. As sessões abertas dessa pessoa foram encerradas." : "Dados atualizados." };
}

// Desativar encerra imediatamente todas as sessões abertas da pessoa.
export async function alternarAtivo(id: string) {
  const gestor = await exigirGestor();
  if (id === gestor.id) return;
  const u = await db.usuario.findUniqueOrThrow({ where: { id } });
  await db.usuario.update({
    where: { id },
    data: { ativo: !u.ativo, versaoSessao: { increment: 1 } },
  });
  revalidatePath("/equipe");
  revalidatePath(`/equipe/${id}`);
}

export async function trocarMinhaSenha(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const eu = await exigirUsuario();
  const atual = String(fd.get("atual") ?? "");
  const nova = String(fd.get("nova") ?? "");
  const confirmacao = String(fd.get("confirmacao") ?? "");
  if (nova.length < 8) return { erro: "A nova senha precisa ter ao menos 8 caracteres." };
  if (nova !== confirmacao) return { erro: "A confirmação não confere." };

  const u = await db.usuario.findUniqueOrThrow({ where: { id: eu.id } });
  if (!(await bcrypt.compare(atual, u.senhaHash))) return { erro: "Senha atual incorreta." };

  const atualizado = await db.usuario.update({
    where: { id: eu.id },
    data: { senhaHash: await bcrypt.hash(nova, 10), versaoSessao: { increment: 1 } },
  });
  await iniciarSessao(atualizado); // mantém esta sessão, encerra as outras
  return { ok: "Senha alterada. Outras sessões abertas foram encerradas." };
}

// Missão do colaborador e o modelo próprio da mensagem de WhatsApp dele.
export async function salvarMissaoEModelo(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  await exigirGestor();
  const missao = String(fd.get("missao") ?? "").trim().slice(0, 4000) || null;
  const modelo = String(fd.get("modeloWhatsapp") ?? "").trim().slice(0, 4000) || null;
  if (modelo && !modelo.includes("{")) {
    return { erro: "O modelo precisa de ao menos um campo, como {primeiro_nome} ou {assunto}. Deixe vazio para usar o padrão." };
  }
  await db.usuario.update({ where: { id }, data: { missao, modeloWhatsapp: modelo } });
  revalidatePath(`/equipe/${id}`);
  revalidatePath("/painel");
  revalidatePath("/conta");
  return { ok: "Missão e mensagem salvas." };
}
