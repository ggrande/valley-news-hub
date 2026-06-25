import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Public update-check endpoint for self-hosters. Their bundled admin pings this
// daily with their current version + license key; we return the latest stable
// release and a short-lived signed download URL.
//
// GET /api/public/network/check-update?license=<key>&v=<current>&channel=stable
//
// Response: { current, latest, breaking, security, changelog_url, download_url }
export const Route = createFileRoute("/api/public/network/check-update")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const license = url.searchParams.get("license")?.trim();
        const current = url.searchParams.get("v")?.trim() ?? "0.0.0";
        const channel = (url.searchParams.get("channel") ?? "stable").trim();

        if (!license) return Response.json({ error: "missing license" }, { status: 400 });

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        if (!SUPABASE_URL || !SERVICE) {
          return Response.json({ error: "server not configured" }, { status: 500 });
        }
        const admin = createClient(SUPABASE_URL, SERVICE, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        // Verify the license key exists and is not revoked
        const { data: lic } = await (admin as any)
          .from("licenses")
          .select("id,revoked,channel")
          .eq("license_key", license)
          .maybeSingle();
        if (!lic || lic.revoked) {
          return Response.json({ error: "invalid license" }, { status: 403 });
        }
        const effectiveChannel = channel || lic.channel || "stable";

        // Latest published release in the requested channel
        const { data: latest } = await (admin as any)
          .from("platform_releases")
          .select("id,version,channel,breaking,security,zip_path,published_at")
          .eq("channel", effectiveChannel)
          .not("published_at", "is", null)
          .order("published_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!latest) {
          return Response.json({ current, latest: null, up_to_date: true });
        }

        const upToDate = compareSemver(current, latest.version) >= 0;

        let downloadUrl: string | null = null;
        if (!upToDate && latest.zip_path) {
          const { data: signed } = await admin.storage
            .from("network-releases")
            .createSignedUrl(latest.zip_path, 60 * 30);
          downloadUrl = signed?.signedUrl ?? null;

          // Best-effort: track that this license was offered this version
          await (admin as any)
            .from("licenses")
            .update({ last_check_at: new Date().toISOString() })
            .eq("id", lic.id);
        }

        const origin = `${url.protocol}//${url.host}`;
        return Response.json({
          current,
          latest: latest.version,
          up_to_date: upToDate,
          breaking: latest.breaking,
          security: latest.security,
          changelog_url: `${origin}/network/changelog`,
          download_url: downloadUrl,
        });
      },
    },
  },
});

function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(/[.\-+]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, "").split(/[.\-+]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}
