// AES-256-GCM helpers for tenant Supabase credentials.
// Server-only. Always import via `await import(...)` inside server handlers.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function deriveKey(): Buffer {
  const raw = process.env.TENANT_CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) throw new Error("TENANT_CREDENTIALS_ENCRYPTION_KEY is not configured");
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): { ciphertext: string; iv: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([enc, tag]).toString("hex"),
    iv: iv.toString("hex"),
  };
}

export function decryptSecret(ciphertextHex: string, ivHex: string): string {
  const buf = Buffer.from(ciphertextHex, "hex");
  const tag = buf.subarray(buf.length - 16);
  const enc = buf.subarray(0, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
