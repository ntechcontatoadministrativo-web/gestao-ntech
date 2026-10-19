// Mensagens de WhatsApp via link wa.me: o gestor revisa o texto e envia pelo próprio WhatsApp.
import type { Prioridade } from "@prisma/client";
import { fmtData } from "./utils";

// "(91) 98888-7777" -> "5591988887777". Retorna null se não parecer um celular brasileiro/internacional.
export function normalizarTelefone(v: string | null | undefined): string | null {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length >= 12 && d.length <= 15) return d;
  return null;
}

export function formatarTelefone(v: string | null | undefined) {
  const d = (v ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v ?? "";
}

export function linkWhatsapp(telefone: string | null | undefined, texto: string) {
  const n = normalizarTelefone(telefone);
  const q = `text=${encodeURIComponent(texto)}`;
  // Sem telefone cadastrado, o WhatsApp abre para escolher o contato.
  return n ? `https://wa.me/${n}?${q}` : `https://wa.me/?${q}`;
}

const ROTULO_PRIORIDADE: Record<Prioridade, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "🔴 URGENTE",
};

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0];

// Campos que o gestor pode usar no modelo de mensagem de cada colaborador.
export const CAMPOS_MODELO = [
  { chave: "primeiro_nome", descricao: "Primeiro nome do colaborador" },
  { chave: "nome", descricao: "Nome completo" },
  { chave: "tipo", descricao: '"tarefa" ou "etapa"' },
  { chave: "assunto", descricao: "Título da tarefa ou nome da etapa" },
  { chave: "projeto", descricao: "Código e nome do projeto" },
  { chave: "etapa", descricao: "Etapa ligada à tarefa" },
  { chave: "cliente", descricao: "Cliente do projeto" },
  { chave: "prazo", descricao: "Prazo (dd/mm/aaaa)" },
  { chave: "prioridade", descricao: "Prioridade da tarefa" },
  { chave: "detalhes", descricao: "Descrição / o que entregar" },
  { chave: "missao", descricao: "Missão do colaborador" },
  { chave: "gestor", descricao: "Primeiro nome de quem designou" },
  { chave: "link", descricao: "Link direto no sistema" },
] as const;

export const MODELO_PADRAO = `Olá, {primeiro_nome}! 👋

{gestor} designou uma nova {tipo} para você:

📌 *{assunto}*
💻 Projeto: {projeto}
🧩 Etapa: {etapa}
👤 Cliente: {cliente}
📅 Prazo: {prazo}
⚡ Prioridade: {prioridade}

{detalhes}

Detalhes e andamento no sistema:
{link}

Qualquer dúvida, me chama por aqui.`;

export type ValoresModelo = Partial<Record<(typeof CAMPOS_MODELO)[number]["chave"], string | null>>;

// Troca {campo} pelos valores. Uma linha que usa um campo vazio é removida inteira,
// assim o mesmo modelo serve para tarefas com ou sem projeto, prazo etc.
export function aplicarModelo(modelo: string, valores: ValoresModelo) {
  const v = valores as Record<string, string | null | undefined>;
  const linhas: string[] = [];
  for (const linha of modelo.replace(/\r\n/g, "\n").split("\n")) {
    const campos = Array.from(linha.matchAll(/\{(\w+)\}/g), (m) => m[1]).filter((c) => c in v || CAMPOS_MODELO.some((x) => x.chave === c));
    if (campos.some((c) => !v[c]?.trim())) continue;
    linhas.push(linha.replace(/\{(\w+)\}/g, (m, c: string) => (c in v ? (v[c] ?? "") : m)));
  }
  return linhas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const resumir = (t: string | null | undefined) => (t && t.length > 600 ? `${t.slice(0, 600)}…` : (t ?? null));

type Responsavel = { nome: string; missao?: string | null; modeloWhatsapp?: string | null };

export function mensagemTarefa(t: {
  titulo: string;
  descricao: string | null;
  prioridade: Prioridade;
  prazo: Date | null;
  responsavel: Responsavel;
  criadoPor?: { nome: string } | null;
  projeto?: { codigo: string; nome: string; cliente?: string | null } | null;
  etapa?: { nome: string } | null;
  url: string;
}) {
  return aplicarModelo(t.responsavel.modeloWhatsapp?.trim() || MODELO_PADRAO, {
    primeiro_nome: primeiroNome(t.responsavel.nome),
    nome: t.responsavel.nome,
    tipo: "tarefa",
    assunto: t.titulo,
    projeto: t.projeto ? `${t.projeto.codigo} · ${t.projeto.nome}` : null,
    etapa: t.etapa?.nome ?? null,
    cliente: t.projeto?.cliente ?? null,
    prazo: t.prazo ? fmtData(t.prazo) : null,
    prioridade: ROTULO_PRIORIDADE[t.prioridade],
    detalhes: resumir(t.descricao),
    missao: t.responsavel.missao ?? null,
    gestor: t.criadoPor ? primeiroNome(t.criadoPor.nome) : "O gestor",
    link: t.url,
  });
}

export function mensagemEtapa(e: {
  nome: string;
  descricao: string | null;
  prazo: Date | null;
  responsavel: Responsavel;
  projeto: { codigo: string; nome: string; cliente?: string | null };
  gestor?: { nome: string } | null;
  url: string;
}) {
  return aplicarModelo(e.responsavel.modeloWhatsapp?.trim() || MODELO_PADRAO, {
    primeiro_nome: primeiroNome(e.responsavel.nome),
    nome: e.responsavel.nome,
    tipo: "etapa",
    assunto: e.nome,
    projeto: `${e.projeto.codigo} · ${e.projeto.nome}`,
    etapa: null, // a própria etapa já é o assunto
    cliente: e.projeto.cliente ?? null,
    prazo: e.prazo ? fmtData(e.prazo) : null,
    prioridade: null,
    detalhes: resumir(e.descricao),
    missao: e.responsavel.missao ?? null,
    gestor: e.gestor ? primeiroNome(e.gestor.nome) : "O gestor",
    link: e.url,
  });
}
