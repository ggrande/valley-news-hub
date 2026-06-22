import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Public cron endpoint: backfills the Reader Discussion thread on posts
// that were generated before automatic comment curation was wired in.
// Walks posts in published_at-desc order, pulls parsed_comments off the
// originating reddit_imports row, and writes filtered in-world comments
// to public.comments with their original author handles and timestamps.
//
// Auth: x-cron-secret header must match the CRON_SECRET secret.
// Idempotent: re-running is safe (existing reddit-sourced comments for
// each touched post are replaced).

export const Route = createFileRoute("/api/public/hooks/backfill-comments")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-secret");
        const expected = process.env.CRON_SECRET;
        if (!expected || !provided || provided !== expected) {
          return new Response("Forbidden", { status: 403 });
        }

        const url = new URL(request.url);
        const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? 100)));
        const onlyMissing = url.searchParams.get("only_missing") !== "0";

        const admin = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );

        // Posts that came from a reddit import. Order by recency so a small
        // backfill run still hits the newest content first.
        const { data: posts, error: postsErr } = await admin
          .from("posts")
          .select("id, published_at, reddit_import_id")
          .not("reddit_import_id", "is", null)
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(limit * 4); // overscan; we filter below
        if (postsErr) {
          return Response.json({ error: postsErr.message }, { status: 500 });
        }

        const { curateAndInsertComments } = await import("@/lib/comment-curation.server");

        const summary = {
          considered: 0,
          skipped_has_comments: 0,
          skipped_no_source_comments: 0,
          updated: 0,
          comments_inserted: 0,
          errors: [] as string[],
        };

        let processed = 0;
        for (const p of posts ?? []) {
          if (processed >= limit) break;
          summary.considered++;

          if (onlyMissing) {
            const { count } = await admin
              .from("comments")
              .select("id", { count: "exact", head: true })
              .eq("post_id", p.id);
            if ((count ?? 0) > 0) {
              summary.skipped_has_comments++;
              continue;
            }
          }

          const { data: imp } = await admin
            .from("reddit_imports")
            .select("parsed_comments, original_created_at")
            .eq("id", p.reddit_import_id)
            .maybeSingle();
          const parsed = (imp?.parsed_comments as any[] | null) ?? [];
          if (!parsed.length) {
            summary.skipped_no_source_comments++;
            continue;
          }

          try {
            const inserted = await curateAndInsertComments(
              admin as any,
              p.id,
              parsed,
              imp?.original_created_at ?? p.published_at ?? null,
            );
            if (inserted > 0) {
              summary.updated++;
              summary.comments_inserted += inserted;
            } else {
              summary.skipped_no_source_comments++;
            }
          } catch (err: any) {
            summary.errors.push(`${p.id}: ${err?.message ?? err}`);
          }
          processed++;
        }

        return Response.json(summary);
      },
    },
  },
});
