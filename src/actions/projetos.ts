"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { StatusProjeto, TipoProjeto } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirGestor } from "@/lib/auth";
import { parseDataInput } from "@/lib/utils";
import { modoArmazenamento, extensaoDe, mimeDe, removerConteudo } from "@/lib/storage";
import * as google from "@/lib/storage/google";
import { registrarLog } from "@/lib/log";
import type { EstadoForm } from "@/components/client";
import { avisar } from "@/lib/avisos";

const texto = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v || null;
};

const TIPOS: TipoProjeto[] = ["SOFTWARE", "SITE", "SUPORTE", "PRODUTO", "INTERNO"];
const url = (v: string | null) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null);

// Campos comuns de criar/editar: tipo, cliente (com o nome copiado), repositório e stack.
async function camposTech(fd: FormData) {
  const tipo = String(fd.get("tipo")) as TipoProjeto;
  const clienteId = texto(fd, "clienteId");
  const cliente = clienteId ? await db.cliente.findUnique({ where: { id: clienteId }, select: { id: true, nome: true } }) : null;
  return {
    tipo: TIPOS.includes(tipo) ? tipo : ("SOFTWARE" as const),
    clienteId: cliente?.id ?? null,
    cliente: cliente?.nome ?? null,
    repositorio: url(texto(fd, "repositorio")),
    stack: texto(fd, "stack"),
  };
}

async function proximoCodigo() {
  const ano = new Date().getFullYear();
  const n = await db.projeto.count({ where: { codigo: { startsWith: `P${ano}-` } } });
  for (let i = n + 1; ; i++) {
    const codigo = `P${ano}-${String(i).padStart(3, "0")}`;
    if (!(await db.projeto.findUnique({ where: { codigo } }))) return codigo;
  }
}

export async function criarProjeto(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const gestor = await exigirGestor();
  const nome = texto(fd, "nome");
  if (!nome) return { erro: "Informe o nome do projeto." };

  const codigo = texto(fd, "codigo")?.toUpperCase() ?? (await proximoCodigo());
  if (await db.projeto.findUnique({ where: { codigo } })) return { erro: `Já existe um projeto com o código ${codigo}.` };

  const dataInicio = parseDataInput(fd.get("dataInicio")) ?? new Date();
  const tech = await camposTech(fd);
  const usarModelo = fd.get("usarModelo") === "on";
  const modelos = usarModelo
    ? await db.modeloEtapa.findMany({ where: { ativo: true, OR: [{ tipo: null }, { tipo: tech.tipo }] }, orderBy: { ordem: "asc" } })
    : [];

  // Prazos sugeridos em sequência a partir da data de início.
  let cursor = dataInicio.getTime();
  const etapas = modelos.map((m, i) => {
    cursor += m.diasPadrao * 86400000;
    return {
      nome: m.nome,
      descricao: m.descricao,
      ordem: i + 1,
      prazo: new Date(cursor),
      responsavelId: texto(fd, `resp_${m.id}`),
    };
  });

  const projeto = await db.projeto.create({
    data: {
      codigo,
      nome,
      ...tech,
      descricao: texto(fd, "descricao"),
      dataInicio,
      prazoFinal: parseDataInput(fd.get("prazoFinal")) ?? (etapas.length ? etapas[etapas.length - 1].prazo : null),
      criadoPorId: gestor.id,
      etapas: { create: etapas },
    },
  });

  await avisar(
    etapas.map((e) => e.responsavelId),
    { tipo: "projeto", titulo: `Você está no projeto ${projeto.codigo}`, texto: projeto.nome, link: `/projetos/${projeto.id}` },
    gestor.id,
  );
  revalidatePath("/projetos");
  redirect(`/projetos/${projeto.id}`);
}

export async function editarProjeto(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  await exigirGestor();
  const nome = texto(fd, "nome");
  const codigo = texto(fd, "codigo")?.toUpperCase();
  if (!nome || !codigo) return { erro: "Nome e código são obrigatórios." };
  const dup = await db.projeto.findFirst({ where: { codigo, NOT: { id } } });
  if (dup) return { erro: `O código ${codigo} já está em uso.` };

  await db.projeto.update({
    where: { id },
    data: {
      nome,
      codigo,
      ...(await camposTech(fd)),
      descricao: texto(fd, "descricao"),
      status: (texto(fd, "status") as StatusProjeto) ?? undefined,
      dataInicio: parseDataInput(fd.get("dataInicio")) ?? undefined,
      prazoFinal: parseDataInput(fd.get("prazoFinal")),
    },
  });
  revalidatePath(`/projetos/${id}`);
  return { ok: "Projeto atualizado." };
}

export async function alterarStatusProjeto(id: string, fd: FormData) {
  await exigirGestor();
  const status = String(fd.get("status")) as StatusProjeto;
  if (!["ATIVO", "PAUSADO", "CONCLUIDO", "CANCELADO"].includes(status)) return;
  await db.projeto.update({ where: { id }, data: { status } });
  revalidatePath(`/projetos/${id}`);
  revalidatePath("/projetos");
}

export async function excluirProjeto(id: string) {
  await exigirGestor();
  // Os arquivos do Drive não são apagados: a pasta do projeto continua lá.
  const projeto = await db.projeto.findUnique({
    where: { id },
    include: { arquivos: { include: { versoes: { where: { armazenamento: "local" } } } } },
  });
  if (!projeto) return;
  for (const a of projeto.arquivos) for (const v of a.versoes) await removerConteudo(v);
  await db.projeto.delete({ where: { id } });
  revalidatePath("/projetos");
  redirect("/projetos");
}

export async function vincularPastaDrive(projetoId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  await exigirGestor();
  if ((await modoArmazenamento()) !== "drive") return { erro: "Conecte o Google Drive em Configurações primeiro." };
  const id = google.extrairIdDrive(String(fd.get("pasta") ?? ""));
  if (!id) return { erro: "Cole o link ou o ID de uma pasta do Google Drive." };
  try {
    const meta = await google.metadados(id);
    if (!google.ehPasta(meta)) return { erro: "Esse link não é de uma pasta." };
    await db.projeto.update({ where: { id: projetoId }, data: { pastaDriveId: id } });
    const importados = await importarDaPasta(projetoId);
    revalidatePath(`/projetos/${projetoId}`);
    return { ok: `Pasta "${meta.name}" vinculada. ${importados} arquivo(s) importado(s).` };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível acessar a pasta." };
  }
}

export async function sincronizarDrive(projetoId: string): Promise<EstadoForm> {
  const gestor = await exigirGestor();
  if ((await modoArmazenamento()) !== "drive") return { erro: "Google Drive não conectado." };
  try {
    const n = await importarDaPasta(projetoId, gestor.id);
    revalidatePath(`/projetos/${projetoId}`);
    return { ok: n ? `${n} arquivo(s) novo(s) importado(s) do Drive.` : "Tudo sincronizado. Nenhum arquivo novo." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao sincronizar." };
  }
}

// Importa arquivos que já estavam nas pastas do Drive (do projeto e das etapas)
// e ainda não estão cadastrados. Subpastas com o nome de uma etapa são vinculadas a ela.
async function importarDaPasta(projetoId: string, usuarioId?: string) {
  const projeto = await db.projeto.findUniqueOrThrow({ where: { id: projetoId }, include: { etapas: true } });
  if (!projeto.pastaDriveId) return 0;

  const conhecidos = new Set(
    (await db.arquivoVersao.findMany({ where: { arquivo: { projetoId } }, select: { driveFileId: true } })).map((v) => v.driveFileId),
  );

  const itensRaiz = await google.listarPasta(projeto.pastaDriveId);
  const pastas: { pastaId: string; etapaId: string | null }[] = [{ pastaId: projeto.pastaDriveId, etapaId: null }];

  const normalizar = (s: string) => s.toLowerCase().replace(/^\d+\s*[-–.]\s*/, "").trim();
  for (const item of itensRaiz.filter(google.ehPasta)) {
    const etapa =
      projeto.etapas.find((e) => e.pastaDriveId === item.id) ??
      projeto.etapas.find((e) => !e.pastaDriveId && normalizar(e.nome) === normalizar(item.name));
    if (etapa) {
      if (!etapa.pastaDriveId) await db.etapa.update({ where: { id: etapa.id }, data: { pastaDriveId: item.id } });
      pastas.push({ pastaId: item.id, etapaId: etapa.id });
    }
  }
  for (const e of projeto.etapas) {
    if (e.pastaDriveId && !pastas.some((p) => p.pastaId === e.pastaDriveId)) pastas.push({ pastaId: e.pastaDriveId, etapaId: e.id });
  }

  let importados = 0;
  for (const { pastaId, etapaId } of pastas) {
    const itens = pastaId === projeto.pastaDriveId ? itensRaiz : await google.listarPasta(pastaId);
    for (const item of itens) {
      if (google.ehPasta(item) || google.ehDocGoogle(item) || conhecidos.has(item.id)) continue;
      const arquivo = await db.arquivo.create({
        data: {
          projetoId,
          etapaId,
          nome: item.name,
          extensao: extensaoDe(item.name),
          acessoEquipe: etapaId ? "BAIXAR" : "VISUALIZAR",
          versoes: {
            create: {
              revisao: 0,
              driveFileId: item.id,
              armazenamento: "drive",
              nomeOriginal: item.name,
              mimeType: mimeDe(item.name, item.mimeType),
              tamanho: Number(item.size ?? 0),
              observacao: "Importado do Google Drive",
              enviadoPorId: usuarioId,
            },
          },
        },
      });
      await registrarLog({ acao: "ENVIOU", usuarioId, arquivoId: arquivo.id, detalhe: "Importado do Drive" });
      importados++;
    }
  }
  return importados;
}
