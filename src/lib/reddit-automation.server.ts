// Reddit comment automation: encryption, template rendering, GitHub dispatch.
// Server-only. Never import this from a *.functions.ts file at module scope —
// always `await import("@/lib/reddit-automation.server")` inside handlers.

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function deriveKey(): Buffer {
  const raw = process.env.REDDIT_SESSION_ENCRYPTION_KEY;
  if (!raw) throw new Error("REDDIT_SESSION_ENCRYPTION_KEY is not configured");
  return createHash("sha256").update(raw).digest();
}

// AES-256-GCM. Returns { ciphertext, iv } where ciphertext = hex(encrypted || tag).
export function encryptString(plain: string): { ciphertext: string; iv: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([enc, tag]).toString("hex"),
    iv: iv.toString("hex"),
  };
}

export function decryptString(ciphertextHex: string, ivHex: string): string {
  const buf = Buffer.from(ciphertextHex, "hex");
  const tag = buf.subarray(buf.length - 16);
  const enc = buf.subarray(0, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// HMAC the (timestamp + body) so we can verify callbacks from GitHub Actions.
export function signPayload(timestamp: string, body: string): string {
  const secret = process.env.REDDIT_WORKER_WEBHOOK_SECRET;
  if (!secret) throw new Error("REDDIT_WORKER_WEBHOOK_SECRET is not configured");
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyPayload(timestamp: string, body: string, signature: string): boolean {
  try {
    const expected = signPayload(timestamp, body);
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    // Reject signatures older than 10 minutes
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 600) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type TemplateVars = {
  article_title: string;
  article_url: string;
  article_dek?: string;
  subreddit?: string;
  reddit_thread_url?: string;
  byline?: string;
};

export function renderTemplate(tpl: string, vars: TemplateVars): string {
  return tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k) => {
    const v = (vars as Record<string, string | undefined>)[k];
    return v ?? "";
  });
}

// Derive a stable canonical Reddit thread URL from a permalink-ish input.
export function normalizeThreadUrl(input: string | null | undefined): { url: string; threadId: string | null; subreddit: string | null } {
  if (!input) return { url: "", threadId: null, subreddit: null };
  const url = input.startsWith("http") ? input : `https://www.reddit.com${input.startsWith("/") ? "" : "/"}${input}`;
  // Match /r/<sub>/comments/<id>
  const m = url.match(/\/r\/([^/]+)\/comments\/([a-z0-9]+)/i);
  return { url, threadId: m?.[2] ?? null, subreddit: m?.[1] ?? null };
}

// Trigger a GitHub repository_dispatch event. Worker authenticates back to us
// via HMAC using REDDIT_WORKER_WEBHOOK_SECRET — the payload only carries an ID.
export async function dispatchGitHubWorkflow(opts: {
  notificationId: string;
  eventType: "reddit-comment" | "reddit-capture-session";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const pat = process.env.GH_DISPATCH_PAT;
  const repo = process.env.GITHUB_REPO; // "owner/repo"
  console.log("[reddit-dispatch] start", { eventType: opts.eventType, notificationId: opts.notificationId, hasPat: Boolean(pat), repo: repo ?? null });
  if (!pat) return { ok: false, error: "GH_DISPATCH_PAT not configured in Lovable Cloud secrets" };
  if (!repo) return { ok: false, error: "GITHUB_REPO not configured (format: owner/repo)" };

  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "wkna49-reddit-automation",
      },
      body: JSON.stringify({
        event_type: opts.eventType,
        client_payload: { notification_id: opts.notificationId, ts: Date.now() },
      }),
    });
  } catch (e: any) {
    console.error("[reddit-dispatch] fetch threw", e?.message);
    return { ok: false, error: `GitHub dispatch network error: ${e?.message ?? String(e)}` };
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[reddit-dispatch] non-2xx", { status: res.status, body: txt.slice(0, 500) });
    return { ok: false, error: `GitHub dispatch failed: ${res.status} ${txt.slice(0, 300)}` };
  }
  console.log("[reddit-dispatch] ok", { status: res.status });
  return { ok: true };
}

// Dispatch the reddit-fetch-listings workflow with a listing job id.
export async function dispatchListingWorkflow(opts: { jobId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const pat = process.env.GH_DISPATCH_PAT;
  const repo = process.env.GITHUB_REPO;
  if (!pat) return { ok: false, error: "GH_DISPATCH_PAT not configured" };
  if (!repo) return { ok: false, error: "GITHUB_REPO not configured (format: owner/repo)" };
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "wkna49-reddit-listings",
      },
      body: JSON.stringify({
        event_type: "reddit-fetch-listings",
        client_payload: { job_id: opts.jobId, ts: Date.now() },
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `GitHub dispatch failed: ${res.status} ${txt.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: `GitHub dispatch network error: ${e?.message ?? String(e)}` };
  }
}
