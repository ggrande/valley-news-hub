// Supabase Management API OAuth + provisioning helpers.
// Server-only. Always load via `await import(...)` inside server handlers.
import { createHash, randomBytes } from "node:crypto";

export const SUPABASE_OAUTH_AUTHORIZE = "https://api.supabase.com/v1/oauth/authorize";
export const SUPABASE_OAUTH_TOKEN = "https://api.supabase.com/v1/oauth/token";
export const SUPABASE_API = "https://api.supabase.com";

export function appBaseUrl(): string {
  const base = process.env.APP_BASE_URL;
  if (!base) throw new Error("APP_BASE_URL is not configured");
  return base.replace(/\/+$/, "");
}

export function redirectUri(): string {
  return `${appBaseUrl()}/api/public/integrations/supabase/callback`;
}

export function clientCreds() {
  const id = process.env.SB_OAUTH_CLIENT_ID;
  const secret = process.env.SB_OAUTH_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Supabase OAuth client credentials missing");
  return { id, secret };
}

// PKCE helpers
function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
export function makePkce() {
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}
export function makeState(): string {
  return base64url(randomBytes(24));
}

export function buildAuthorizeUrl(opts: { state: string; codeChallenge: string }): string {
  const { id } = clientCreds();
  const p = new URLSearchParams({
    client_id: id,
    response_type: "code",
    redirect_uri: redirectUri(),
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${SUPABASE_OAUTH_AUTHORIZE}?${p.toString()}`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: string;
};

export async function exchangeCodeForTokens(opts: {
  code: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  const { id, secret } = clientCreds();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: redirectUri(),
    code_verifier: opts.codeVerifier,
    client_id: id,
    client_secret: secret,
  });
  const res = await fetch(SUPABASE_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

export async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const { id, secret } = clientCreds();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: id,
    client_secret: secret,
  });
  const res = await fetch(SUPABASE_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

// --- Authenticated Management API calls ---

async function mgmt<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase API ${res.status} on ${path}: ${await res.text()}`);
  }
  // Some endpoints return empty body.
  const text = await res.text();
  return (text ? JSON.parse(text) : ({} as T)) as T;
}

export type SbOrg = { id: string; name: string; slug?: string };
export async function listOrganizations(accessToken: string): Promise<SbOrg[]> {
  return mgmt<SbOrg[]>(accessToken, "/v1/organizations");
}

export type SbProject = {
  id: string; // project ref
  name: string;
  organization_id: string;
  region: string;
  status: string; // ACTIVE_HEALTHY, COMING_UP, INIT_FAILED, etc.
  database?: { host: string };
};
export async function listProjects(accessToken: string): Promise<SbProject[]> {
  return mgmt<SbProject[]>(accessToken, "/v1/projects");
}
export async function getProject(accessToken: string, ref: string): Promise<SbProject> {
  return mgmt<SbProject>(accessToken, `/v1/projects/${ref}`);
}

export async function createProject(
  accessToken: string,
  opts: { name: string; organization_id: string; region: string; db_pass: string; plan?: "free" | "pro" },
): Promise<SbProject> {
  return mgmt<SbProject>(accessToken, "/v1/projects", {
    method: "POST",
    body: JSON.stringify({ plan: "free", ...opts }),
  });
}

export async function deleteProject(accessToken: string, ref: string): Promise<void> {
  await mgmt(accessToken, `/v1/projects/${ref}`, { method: "DELETE" });
}


export type ApiKey = { name: string; api_key: string };
export async function getApiKeys(accessToken: string, ref: string): Promise<ApiKey[]> {
  return mgmt<ApiKey[]>(accessToken, `/v1/projects/${ref}/api-keys`);
}

export async function runSql(accessToken: string, ref: string, query: string): Promise<unknown> {
  return mgmt(accessToken, `/v1/projects/${ref}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}
