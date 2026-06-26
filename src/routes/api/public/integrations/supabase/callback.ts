// Supabase Management API OAuth callback.
// Public route by URL — security comes from the signed `state` row plus the
// PKCE verifier we stored server-side. The callback is hit by the browser
// after the buyer authorizes on supabase.com.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/integrations/supabase/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const oauthError = url.searchParams.get("error");

        const appBase = (process.env.APP_BASE_URL || url.origin).replace(/\/+$/, "");

        if (oauthError) {
          return Response.redirect(
            `${appBase}/account/managed-sites?supabase_error=${encodeURIComponent(oauthError)}`,
            302,
          );
        }
        if (!code || !state) {
          return new Response("Missing code or state", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { encryptSecret } = await import("@/lib/tenant-crypto.server");
        const sbo = await import("@/lib/supabase-oauth.server");

        // Look up + consume the state row (one-shot)
        const { data: stateRow, error: stErr } = await (supabaseAdmin as any)
          .from("supabase_oauth_states")
          .select("state, code_verifier, user_id, site_id, expires_at")
          .eq("state", state)
          .maybeSingle();
        if (stErr || !stateRow) {
          return new Response("Invalid or expired OAuth state", { status: 400 });
        }
        if (new Date(stateRow.expires_at).getTime() < Date.now()) {
          await (supabaseAdmin as any)
            .from("supabase_oauth_states")
            .delete()
            .eq("state", state);
          return new Response("OAuth state expired; please retry", { status: 400 });
        }

        // Delete state row eagerly so it can't be replayed
        await (supabaseAdmin as any)
          .from("supabase_oauth_states")
          .delete()
          .eq("state", state);

        try {
          const tokens = await sbo.exchangeCodeForTokens({
            code,
            codeVerifier: stateRow.code_verifier,
          });
          const access = encryptSecret(tokens.access_token);
          const refresh = encryptSecret(tokens.refresh_token);

          if (stateRow.site_id) {
            await (supabaseAdmin as any)
              .from("managed_sites")
              .update({
                supabase_access_token_enc: access.ciphertext,
                supabase_access_token_iv: access.iv,
                supabase_access_token_expires_at: new Date(
                  Date.now() + tokens.expires_in * 1000,
                ).toISOString(),
                supabase_refresh_token_enc: refresh.ciphertext,
                supabase_refresh_token_iv: refresh.iv,
                provision_state: "linking",
                provision_error: null,
              })
              .eq("id", stateRow.site_id)
              .eq("owner_user_id", stateRow.user_id);
          }

          const dest = stateRow.site_id
            ? `${appBase}/account/managed-sites/${stateRow.site_id}/onboarding?supabase=connected`
            : `${appBase}/account/managed-sites?supabase=connected`;
          return Response.redirect(dest, 302);
        } catch (e) {
          const msg = encodeURIComponent((e as Error).message.slice(0, 240));
          if (stateRow.site_id) {
            await (supabaseAdmin as any)
              .from("managed_sites")
              .update({
                provision_state: "failed",
                provision_error: (e as Error).message.slice(0, 1000),
              })
              .eq("id", stateRow.site_id);
          }
          return Response.redirect(
            `${appBase}/account/managed-sites/${stateRow.site_id ?? ""}/onboarding?supabase_error=${msg}`,
            302,
          );
        }
      },
    },
  },
});
