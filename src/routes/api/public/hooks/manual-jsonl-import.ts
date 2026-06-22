import { createFileRoute } from "@tanstack/react-router";

// One-shot importer for the pre-built article_jobs.jsonl in the reddit-archives bucket.
// Idempotent: deletes existing rows for the batch before inserting.
export const Route = createFileRoute("/api/public/hooks/manual-jsonl-import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-import-token");
        if (token !== "wkna-manual-jsonl-2026") {
          return new Response("Forbidden", { status: 403 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const ADMIN = "802c72d2-ff6c-4f0e-a565-b6bdd8c3ae2f";
        const BATCH = "11111111-2222-3333-4444-555555555555";

        const { data: blob, error: dlErr } = await supabaseAdmin.storage
          .from("reddit-archives")
          .download("manual/article_jobs.jsonl");
        if (dlErr || !blob) {
          return new Response(`download error: ${dlErr?.message}`, { status: 500 });
        }
        const text = await blob.text();
        const lines = text.split("\n").filter(Boolean);

        await supabaseAdmin.from("reddit_imports").delete().eq("batch_id", BATCH);

        let totalComments = 0;
        const rows: any[] = [];
        for (const line of lines) {
          const j = JSON.parse(line);
          const sp = j.source_post;
          const comments = (j.comments || []).map((c: any) => ({
            id: c.reddit_id,
            author: c.reddit_author_id,
            body: c.body,
            score: c.score,
            created_at: c.created_at,
            parent_id: c.parent_id,
            expert_candidate_score: c.expert_candidate_score,
          }));
          totalComments += comments.length;
          const mediaPaths = (j.header_media_candidates || [])
            .map((m: any) => m.local_path || m.source_url)
            .filter(Boolean);
          rows.push({
            batch_id: BATCH,
            reddit_post_id: sp.reddit_id,
            subreddit: sp.subreddit,
            original_title: sp.title,
            original_body: sp.body || "",
            original_author_display: sp.reddit_author_id,
            original_created_at: sp.published_at_for_article || sp.created_at,
            source_score: sp.score ?? null,
            parsed_comments: comments,
            source_url: sp.source_url,
            permalink: sp.source_url,
            link_flair_text: sp.flair,
            media_paths: mediaPaths,
            import_status: "new",
            moderation_status: "pending",
            moderation_reasons: [],
            created_by: ADMIN,
          });
        }

        await supabaseAdmin.from("import_batches").upsert({
          id: BATCH,
          label: "Manual JSONL import (poisonai)",
          source_filename: "manual/article_jobs.jsonl",
          size_bytes: text.length,
          status: "complete",
          total_posts: rows.length,
          total_comments: totalComments,
          total_media: 0,
          created_by: ADMIN,
        });

        // Insert in chunks of 100
        let inserted = 0;
        for (let i = 0; i < rows.length; i += 100) {
          const slice = rows.slice(i, i + 100);
          const { error } = await supabaseAdmin.from("reddit_imports").insert(slice);
          if (error) {
            return new Response(
              JSON.stringify({ inserted, error: error.message, atChunk: i }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }
          inserted += slice.length;
        }

        return new Response(
          JSON.stringify({ ok: true, inserted, totalComments, batchId: BATCH }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
