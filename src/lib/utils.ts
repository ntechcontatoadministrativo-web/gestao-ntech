import clsx, { type ClassValue } from "clsx";

// URL pública do sistema. No Render, cai para a URL que a própria plataforma informa.
export const appUrl = () => (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");

export function cn(...classes: ClassValue[]) {
  return clsx(classes);
}

export const fmtData = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Belem" }) : "—";

export const fmtDataHora = (d: Date | string | null | undefined) =>
  d
    ? new Date(d).toLocaleString("pt-BR", {
        timeZone: "America/Belem",
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export function fmtTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

// R00, R01, R02...
export const fmtRevisao = (n: number) => `R${String(n).padStart(2, "0")}`;

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

export function tempoRelativo(d: Date | string | null | undefined) {
  if (!d) return "nunca";
  const seg = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (seg < 60) return "agora";
  const min = Math.round(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.round(h / 24);
  return `há ${dias} dia${dias > 1 ? "s" : ""}`;
}

export const ONLINE_JANELA_MS = 2 * 60 * 1000;
export const estaOnline = (d: Date | null | undefined) => !!d && Date.now() - new Date(d).getTime() < ONLINE_JANELA_MS;

// Início do dia de hoje em Belém (UTC-3, sem horário de verão)
export function hojeInicio() {
  const agora = new Date();
  const belem = new Date(agora.getTime() - 3 * 3600 * 1000);
  belem.setUTCHours(0, 0, 0, 0);
  return new Date(belem.getTime() + 3 * 3600 * 1000);
}

export function diasAte(d: Date | string) {
  return Math.ceil((new Date(d).getTime() - hojeInicio().getTime()) / 86400000);
}

// "2026-10-19" -> Date ao meio-dia de Belém (evita virar o dia por fuso)
export function parseDataInput(v: FormDataEntryValue | null): Date | null {
  if (!v || typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return new Date(`${v}T15:00:00.000Z`);
}

export function dataParaInput(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(new Date(d).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

// "YYYY-MM-DD" do dia em Belém (UTC-3)
export function diaBelem(d: Date | string = new Date()) {
  return new Date(new Date(d).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

// [início, fim) de um dia de Belém, a partir de "YYYY-MM-DD"
export function intervaloDia(ymd: string): [Date, Date] {
  const ini = new Date(`${ymd}T03:00:00.000Z`);
  return [ini, new Date(ini.getTime() + 86400000)];
}

// "1:30", "1h30", "1,5" ou "90min" -> minutos
export function parseHoras(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().toLowerCase().replace(/\s/g, "");
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[:h](\d{1,2})?m?(in)?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  m = s.match(/^(\d{1,4})min$/);
  if (m) return Number(m[1]);
  const n = Number(s.replace(",", ".").replace(/h$/, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : null;
}

export const fmtMinutos = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
};

export const fmtMoeda = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// "1.234,56", "1234.56" ou "R$ 1.234" -> centavos
export function parseMoeda(v: FormDataEntryValue | null): number {
  let s = String(v ?? "").replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

export const fmtNumeroTarefa = (n: number) => `#${n}`;
