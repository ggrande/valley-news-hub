// Ingest a built release ZIP from the publish-release GitHub Action.
// Authenticated with a shared secret (NETWORK_RELEASE_INGEST_SECRET) so we
// don't have to expose the Supabase service-role key to GitHub.
//
// Body: multipart form-data with fields:
//   version, channel, breaking, security, sha256, notes (md), and `zip` file.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const fieldSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+(-[\w.]+)?$/),
  channel: z.enum(["stable", "beta"]).default("stable"),
  breaking: z.enum(["true", "false"]).default("false"),
  security: z.enum(["true", "false"]).default("false"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  notes: z.string().max(50_000).optional(),
});

export const Route = createFileRoute("/api/public/network/ingest-release")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.NETWORK_RELEASE_INGEST_SECRET;
        if (!secret) return new Response("Ingest secret not configured", { status: 500 });
        const provided = request.headers.get("x-ingest-secret");
        if (!provided || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return new Response("Expected multipart/form-data", { status: 400 });
        }

        const parsed = fieldSchema.safeParse({
          version: form.get("version"),
          channel: form.get("channel") ?? "stable",
          breaking: form.get("breaking") ?? "false",
          security: form.get("security") ?? "false",
          sha256: form.get("sha256"),
          notes: form.get("notes") ?? undefined,
        });
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 400 });
        }
        const fields = parsed.data;

        const zip = form.get("zip");
        if (!(zip instanceof File)) return new Response("Missing zip file", { status: 400 });
        const buf = new Uint8Array(await zip.arrayBuffer());
        if (buf.length === 0) return new Response("Empty zip", { status: 400 });
        if (buf.length > 200 * 1024 * 1024) return new Response("Zip too large", { status: 413 });

        // Verify sha matches
        const digest = await crypto.subtle.digest("SHA-256", buf);
        const computed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
        if (computed.toLowerCase() !== fields.sha256.toLowerCase()) {
          return Response.json({ error: "sha256 mismatch", computed }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const objectPath = `releases/${fields.version}/wkna49-platform-${fields.version}.zip`;

        const { error: upErr } = await supabaseAdmin.storage
          .from("network-releases")
          .upload(objectPath, buf, {
            contentType: "application/zip",
            upsert: true,
          });
        if (upErr) {
          console.error("[ingest-release] storage upload failed", upErr);
          return Response.json({ error: upErr.message }, { status: 500 });
        }

        const row = {
          version: fields.version,
          channel: fields.channel,
          title: `v${fields.version}`,
          changelog_md: fields.notes && fields.notes.trim().length > 0
            ? fields.notes
            : "_Release notes not provided._",
          breaking: fields.breaking === "true",
          security: fields.security === "true",
          zip_path: objectPath,
          zip_sha256: fields.sha256.toLowerCase(),
          zip_bytes: buf.length,
          published_at: new Date().toISOString(),
        };
        const { data, error } = await (supabaseAdmin as any)
          .from("platform_releases")
          .upsert(row, { onConflict: "version,channel" })
          .select("id")
          .single();
        if (error) {
          console.error("[ingest-release] insert failed", error);
          return Response.json({ error: error.message }, { status: 500 });
        }
        return Response.json({ ok: true, id: data?.id, version: fields.version });
      },
    },
  },
});
