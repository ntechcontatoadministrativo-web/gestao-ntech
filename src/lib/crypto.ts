import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Aceita 64 caracteres hex ou qualquer segredo longo (ex.: gerado pelo Render), derivado via SHA-256.
// Sem ENCRYPTION_KEY, deriva da DIRECT_URL/DATABASE_URL (trocar a senha do banco exige reconectar o Drive).
function chave(): Buffer {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const v = process.env.ENCRYPTION_KEY || (url ? `ntech-cripto|${url}` : "");
  if (!v || v.length < 32) throw new Error("ENCRYPTION_KEY ausente ou curta (mínimo 32 caracteres).");
  return /^[0-9a-f]{64}$/i.test(v) ? Buffer.from(v, "hex") : createHash("sha256").update(v).digest();
}

// AES-256-GCM. Formato: iv.tag.dados (base64url)
export function criptografar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, dados].map((b) => b.toString("base64url")).join(".");
}

export function descriptografar(valor: string): string {
  const [iv, tag, dados] = valor.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", chave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(dados), decipher.final()]).toString("utf8");
}
