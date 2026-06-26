// Server functions that drive the per-tenant Supabase provisioning flow:
//   1. initiateSupabaseConnect    -> returns the Supabase OAuth URL
//   2. getProvisioningStatus      -> what state is this site in?
//   3. listConnectedOrganizations -> orgs the buyer can choose from
//   4. provisionTenantProject     -> creates the project + runs base schema
//
// The OAuth callback itself lives in
// src/routes/api/public/integrations/supabase/callback.ts
//
// NOTE: This module is reachable from client bundles (only handler bodies are
// stripped), so all server-only modules are loaded inside handlers.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomBytes } from "node:crypto";

// ---------- TYPES (client-safe) ----------

export type ProvisioningStatus = {
  siteId: string;
  state:
    | "awaiting_oauth"
    | "linking"
    | "provisioning"
    | "migrating"
    | "ready"
    | "failed";
  error: string | null;
  org: { id: string; name: string | null } | null;
  project: { ref: string; url: string } | null;
  startedAt: string | null;
  finishedAt: string | null;
  hasRefreshToken: boolean;
};

// ---------- 1. INITIATE OAUTH ----------

export const initiateSupabaseConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { siteId: string }) => d)
  .handler(async ({ data, context }) => {
    // Verify caller owns this site
    const { data: site, error } = await (context.supabase as any)
      .from("managed_sites")
      .select("id, owner_user_id")
      .eq("id", data.siteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!site || site.owner_user_id !== context.userId) {
      throw new Error("Site not found or access denied");
    }

    const { makePkce, makeState, buildAuthorizeUrl } = await import(
      "@/lib/supabase-oauth.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { verifier, challenge } = makePkce();
    const state = makeState();

    const { error: insErr } = await (supabaseAdmin as any)
      .from("supabase_oauth_states")
      .insert({
        state,
        code_verifier: verifier,
        user_id: context.userId,
        site_id: data.siteId,
      });
    if (insErr) throw new Error(insErr.message);

    // Best-effort cleanup of expired rows
    await (supabaseAdmin as any)
      .from("supabase_oauth_states")
      .delete()
      .lt("expires_at", new Date().toISOString());

    // Flip state so the wizard knows we're mid-handshake
    await (supabaseAdmin as any)
      .from("managed_sites")
      .update({ provision_state: "linking", provision_error: null })
      .eq("id", data.siteId);

    return { authorizeUrl: buildAuthorizeUrl({ state, codeChallenge: challenge }) };
  });

// ---------- 2. STATUS ----------

export const getProvisioningStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { siteId: string }) => d)
  .handler(async ({ data, context }): Promise<ProvisioningStatus> => {
    const { data: row, error } = await (context.supabase as any)
      .from("managed_sites")
      .select(
        "id, provision_state, provision_error, supabase_org_id, supabase_org_name, supabase_project_ref, supabase_project_url, provision_started_at, provisioned_at, supabase_refresh_token_enc",
      )
      .eq("id", data.siteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Site not found");
    return {
      siteId: row.id,
      state: row.provision_state,
      error: row.provision_error,
      org: row.supabase_org_id ? { id: row.supabase_org_id, name: row.supabase_org_name } : null,
      project: row.supabase_project_ref
        ? { ref: row.supabase_project_ref, url: row.supabase_project_url ?? "" }
        : null,
      startedAt: row.provision_started_at,
      finishedAt: row.provisioned_at,
      hasRefreshToken: !!row.supabase_refresh_token_enc,
    };
  });

// ---------- 3. LIST ORGS ----------

export const listConnectedOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { siteId: string }) => d)
  .handler(async ({ data, context }) => {
    const token = await getValidAccessToken(context.userId, data.siteId);
    const { listOrganizations } = await import("@/lib/supabase-oauth.server");
    return listOrganizations(token);
  });

// ---------- 4. PROVISION ----------

export const provisionTenantProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { siteId: string; organizationId: string; region?: string; projectName?: string }) => d,
  )
  .handler(async ({ data, context }) => {
    const region = data.region || "us-east-1";
    const accessToken = await getValidAccessToken(context.userId, data.siteId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptSecret } = await import("@/lib/tenant-crypto.server");
    const sbo = await import("@/lib/supabase-oauth.server");

    // Read site to derive name & confirm ownership
    const { data: site, error: siteErr } = await (supabaseAdmin as any)
      .from("managed_sites")
      .select("id, owner_user_id, display_name, subdomain, supabase_project_ref")
      .eq("id", data.siteId)
      .maybeSingle();
    if (siteErr) throw new Error(siteErr.message);
    if (!site || site.owner_user_id !== context.userId)
      throw new Error("Site not found or access denied");
    if (site.supabase_project_ref)
      throw new Error("This station already has a Supabase project provisioned");

    // Guard against concurrent / duplicate clicks
    const { data: stateRow } = await (supabaseAdmin as any)
      .from("managed_sites")
      .select("provision_state")
      .eq("id", data.siteId)
      .maybeSingle();
    if (
      stateRow &&
      (stateRow.provision_state === "provisioning" ||
        stateRow.provision_state === "migrating" ||
        stateRow.provision_state === "ready")
    ) {
      throw new Error("Provisioning is already in progress for this station.");
    }

    const orgs = await sbo.listOrganizations(accessToken);
    const org = orgs.find((o) => o.id === data.organizationId);
    if (!org) throw new Error("Organization not found in your Supabase account");

    // Generate strong DB password (also stored encrypted so the buyer can retrieve it)
    const dbPass = randomBytes(24).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 28);

    await (supabaseAdmin as any)
      .from("managed_sites")
      .update({
        provision_state: "provisioning",
        provision_error: null,
        provision_started_at: new Date().toISOString(),
        supabase_org_id: org.id,
        supabase_org_name: org.name,
      })
      .eq("id", data.siteId);

    // Supabase project names must be unique per organization. If the chosen name
    // already exists (e.g. retry after a previous failed attempt), append a short
    // random suffix and retry up to 2 times.
    const baseName = (data.projectName || `${site.display_name} (${site.subdomain})`).slice(0, 44);
    const attemptNames = [
      baseName.slice(0, 50),
      `${baseName.slice(0, 43)}-${randomBytes(3).toString("hex")}`.slice(0, 50),
      `${baseName.slice(0, 38)}-${randomBytes(5).toString("hex")}`.slice(0, 50),
    ];

    let project: import("@/lib/supabase-oauth.server").SbProject | null = null;
    let lastErr: Error | null = null;
    for (const name of attemptNames) {
      try {
        project = await sbo.createProject(accessToken, {
          name,
          organization_id: org.id,
          region,
          db_pass: dbPass,
          plan: "free",
        });
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e as Error;
        if (!/already exists/i.test(lastErr.message)) break;
      }
    }
    if (!project) {
      await markFailed(data.siteId, (lastErr ?? new Error("Project creation failed")).message);
      throw lastErr ?? new Error("Project creation failed");
    }

    const dbPassEnc = encryptSecret(dbPass);
    await (supabaseAdmin as any)
      .from("managed_sites")
      .update({
        supabase_project_ref: project.id,
        supabase_project_url: `https://${project.id}.supabase.co`,
        supabase_db_password_enc: dbPassEnc.ciphertext,
        supabase_db_password_iv: dbPassEnc.iv,
      })
      .eq("id", data.siteId);

    return {
      ok: true,
      projectRef: project.id,
      message:
        "Project creation kicked off. It usually takes 1–2 minutes to become healthy; we'll finalize migrations automatically once it is.",
    };
  });

// ---------- 5. FINALIZE (polls + runs migrations + stores keys) ----------

export const finalizeTenantProvisioning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { siteId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptSecret } = await import("@/lib/tenant-crypto.server");
    const sbo = await import("@/lib/supabase-oauth.server");

    const { data: site, error } = await (supabaseAdmin as any)
      .from("managed_sites")
      .select("id, owner_user_id, supabase_project_ref, provision_state")
      .eq("id", data.siteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!site || site.owner_user_id !== context.userId)
      throw new Error("Site not found or access denied");
    if (!site.supabase_project_ref) throw new Error("No Supabase project to finalize yet");
    if (site.provision_state === "ready")
      return { ok: true, state: "ready" as const, message: "Already provisioned" };

    const accessToken = await getValidAccessToken(context.userId, data.siteId);
    const project = await sbo.getProject(accessToken, site.supabase_project_ref);

    if (project.status !== "ACTIVE_HEALTHY") {
      return {
        ok: false,
        state: "provisioning" as const,
        message: `Project status: ${project.status}. Try again in ~30s.`,
      };
    }

    // Fetch API keys
    let keys: import("@/lib/supabase-oauth.server").ApiKey[] = [];
    try {
      keys = await sbo.getApiKeys(accessToken, site.supabase_project_ref);
    } catch (e) {
      await markFailed(data.siteId, `Could not fetch API keys: ${(e as Error).message}`);
      throw e;
    }
    const anon = keys.find((k) => k.name === "anon")?.api_key ?? "";
    const service = keys.find((k) => k.name === "service_role")?.api_key ?? "";
    if (!anon || !service) {
      await markFailed(data.siteId, "Project keys not yet available");
      throw new Error("Project keys not yet available; try again shortly");
    }

    // Run the base bootstrap migration on the tenant project.
    await (supabaseAdmin as any)
      .from("managed_sites")
      .update({ provision_state: "migrating" })
      .eq("id", data.siteId);

    const { BASE_TENANT_BOOTSTRAP_SQL } = await import("@/lib/tenant-bootstrap-sql.server");
    try {
      await sbo.runSql(accessToken, site.supabase_project_ref, BASE_TENANT_BOOTSTRAP_SQL);
    } catch (e) {
      await markFailed(data.siteId, `Migration failed: ${(e as Error).message}`);
      throw e;
    }

    const anonEnc = encryptSecret(anon);
    const svcEnc = encryptSecret(service);
    await (supabaseAdmin as any)
      .from("managed_sites")
      .update({
        provision_state: "ready",
        provisioned_at: new Date().toISOString(),
        provision_error: null,
        supabase_anon_key_enc: anonEnc.ciphertext,
        supabase_anon_key_iv: anonEnc.iv,
        supabase_service_key_enc: svcEnc.ciphertext,
        supabase_service_key_iv: svcEnc.iv,
      })
      .eq("id", data.siteId);

    return { ok: true, state: "ready" as const, message: "Tenant project is live" };
  });

// ---------- INTERNAL: token freshness ----------

async function getValidAccessToken(userId: string, siteId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptSecret, encryptSecret } = await import("@/lib/tenant-crypto.server");
  const { refreshTokens } = await import("@/lib/supabase-oauth.server");

  const { data: row, error } = await (supabaseAdmin as any)
    .from("managed_sites")
    .select(
      "owner_user_id, supabase_refresh_token_enc, supabase_refresh_token_iv, supabase_access_token_enc, supabase_access_token_iv, supabase_access_token_expires_at",
    )
    .eq("id", siteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || row.owner_user_id !== userId) throw new Error("Access denied");
  if (!row.supabase_refresh_token_enc)
    throw new Error("Supabase isn't connected for this site yet");

  const exp = row.supabase_access_token_expires_at
    ? new Date(row.supabase_access_token_expires_at).getTime()
    : 0;
  if (
    row.supabase_access_token_enc &&
    row.supabase_access_token_iv &&
    exp > Date.now() + 60_000
  ) {
    return decryptSecret(row.supabase_access_token_enc, row.supabase_access_token_iv);
  }

  // Refresh
  const refresh = decryptSecret(
    row.supabase_refresh_token_enc,
    row.supabase_refresh_token_iv,
  );
  const tok = await refreshTokens(refresh);
  const a = encryptSecret(tok.access_token);
  const r = encryptSecret(tok.refresh_token);
  await (supabaseAdmin as any)
    .from("managed_sites")
    .update({
      supabase_access_token_enc: a.ciphertext,
      supabase_access_token_iv: a.iv,
      supabase_access_token_expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
      supabase_refresh_token_enc: r.ciphertext,
      supabase_refresh_token_iv: r.iv,
    })
    .eq("id", siteId);
  return tok.access_token;
}

async function markFailed(siteId: string, message: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any)
    .from("managed_sites")
    .update({ provision_state: "failed", provision_error: message.slice(0, 1000) })
    .eq("id", siteId);
}
