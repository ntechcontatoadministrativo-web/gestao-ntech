import "server-only";
import { db } from "../db";
import { criptografar, descriptografar } from "../crypto";
import { appUrl } from "../utils";

// Integração com Google Drive via REST (OAuth com a conta do escritório).
// Os arquivos ficam no Drive da empresa; a equipe não precisa ter acesso direto às pastas.

const ESCOPO = "https://www.googleapis.com/auth/drive openid email";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

export const CFG_REFRESH = "google.refresh";
export const CFG_CONTA = "google.conta";
export const CFG_PASTA_RAIZ = "google.pastaRaiz";

export function googleConfigurado() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

const redirectUri = () => `${appUrl()}/api/google/callback`;

export function urlAutorizacao(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: ESCOPO,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function trocarCodigo(code: string) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const j = await r.json();
  if (!r.ok || !j.refresh_token) throw new Error(j.error_description || "Falha ao obter autorização do Google.");

  let conta = "";
  try {
    const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${j.access_token}` },
    }).then((x) => x.json());
    conta = info.email ?? "";
  } catch {}

  await salvarConfig(CFG_REFRESH, criptografar(j.refresh_token));
  await salvarConfig(CFG_CONTA, conta);
  cacheToken = { token: j.access_token, expira: Date.now() + (j.expires_in - 60) * 1000 };
  return conta;
}

async function salvarConfig(chave: string, valor: string) {
  await db.config.upsert({ where: { chave }, update: { valor }, create: { chave, valor } });
}

export async function lerConfig(chave: string) {
  return (await db.config.findUnique({ where: { chave } }))?.valor ?? null;
}

export async function driveConectado() {
  return googleConfigurado() && !!(await lerConfig(CFG_REFRESH));
}

export async function desconectarDrive() {
  await db.config.deleteMany({ where: { chave: { in: [CFG_REFRESH, CFG_CONTA] } } });
  cacheToken = null;
}

let cacheToken: { token: string; expira: number } | null = null;

async function accessToken(): Promise<string> {
  if (cacheToken && cacheToken.expira > Date.now()) return cacheToken.token;
  const enc = await lerConfig(CFG_REFRESH);
  if (!enc) throw new Error("Google Drive não conectado.");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: descriptografar(enc),
      grant_type: "refresh_token",
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Google recusou o token (${j.error}). Reconecte o Drive em Configurações.`);
  cacheToken = { token: j.access_token, expira: Date.now() + (j.expires_in - 60) * 1000 };
  return j.access_token as string;
}

async function gfetch(url: string, init: RequestInit = {}) {
  const token = await accessToken();
  const r = await fetch(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Google Drive ${r.status}: ${txt.slice(0, 300)}`);
  }
  return r;
}

const PASTA_MIME = "application/vnd.google-apps.folder";

export type ItemDrive = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
  modifiedTime?: string;
};

export async function criarPasta(nome: string, paiId?: string | null): Promise<string> {
  const r = await gfetch(`${API}/files?fields=id&supportsAllDrives=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: nome, mimeType: PASTA_MIME, parents: paiId ? [paiId] : undefined }),
  });
  return (await r.json()).id;
}

export async function pastaRaiz(): Promise<string> {
  const existente = await lerConfig(CFG_PASTA_RAIZ);
  if (existente) return existente;
  const id = await criarPasta("NTECH Hub");
  await salvarConfig(CFG_PASTA_RAIZ, id);
  return id;
}

export async function definirPastaRaiz(id: string) {
  const meta = await metadados(id); // valida que existe e é acessível
  if (!ehPasta(meta)) throw new Error("O link informado não é uma pasta.");
  await salvarConfig(CFG_PASTA_RAIZ, id);
}

export async function metadados(id: string): Promise<ItemDrive> {
  const r = await gfetch(
    `${API}/files/${encodeURIComponent(id)}?fields=id,name,mimeType,size,parents,modifiedTime&supportsAllDrives=true`,
  );
  return r.json();
}

export async function listarPasta(pastaId: string): Promise<ItemDrive[]> {
  const itens: ItemDrive[] = [];
  let pageToken: string | undefined;
  const idSeguro = pastaId.replace(/[^\w-]/g, "");
  do {
    const p = new URLSearchParams({
      q: `"${idSeguro}" in parents and trashed = false`,
      fields: "nextPageToken, files(id,name,mimeType,size,modifiedTime)",
      pageSize: "200",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) p.set("pageToken", pageToken);
    const j = await (await gfetch(`${API}/files?${p}`)).json();
    itens.push(...j.files);
    pageToken = j.nextPageToken;
  } while (pageToken);
  return itens;
}

// Sessão de upload resumível. O navegador envia o arquivo direto ao Google
// (sem passar pelo nosso servidor e sem limite de tamanho), por isso o Origin.
export async function iniciarUploadResumivel(opts: {
  nome: string;
  mime: string;
  tamanho: number;
  pastaId: string;
  origin: string;
}) {
  const r = await gfetch(
    `${UPLOAD_API}/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,size,parents,mimeType`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": opts.mime,
        "X-Upload-Content-Length": String(opts.tamanho),
        Origin: opts.origin,
      },
      body: JSON.stringify({ name: opts.nome, parents: [opts.pastaId] }),
    },
  );
  const url = r.headers.get("location");
  if (!url) throw new Error("Google Drive não retornou a URL de upload.");
  return url;
}

export async function baixar(id: string, range?: string | null): Promise<Response> {
  return gfetch(`${API}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, {
    headers: range ? { Range: range } : {},
  });
}

export async function lixeira(id: string) {
  await gfetch(`${API}/files/${encodeURIComponent(id)}?supportsAllDrives=true`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
}

export const ehPasta = (i: ItemDrive) => i.mimeType === PASTA_MIME;
export const ehDocGoogle = (i: ItemDrive) => i.mimeType.startsWith("application/vnd.google-apps.");

// Aceita o ID puro ou um link do Drive (…/folders/ID, …/d/ID ou ?id=ID)
export function extrairIdDrive(v: string) {
  const s = v.trim();
  const m = s.match(/\/folders\/([\w-]{10,})/) || s.match(/\/d\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/);
  if (m) return m[1];
  return /^[\w-]{10,}$/.test(s) ? s : null;
}
