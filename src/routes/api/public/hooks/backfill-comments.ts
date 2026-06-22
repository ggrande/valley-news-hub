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
        // backfill run still hits the newest content first. We pre-filter
        // out posts that already have reddit-sourced comments so each call
        // makes progress instead of re-scanning the same head of the list.
        let alreadyHave = new Set<string>();
        if (onlyMissing) {
          const { data: withComments } = await admin
            .from("comments")
            .select("post_id")
            .eq("source_type", "reddit");
          alreadyHave = new Set(((withComments ?? []) as any[]).map((r) => r.post_id));
        }
        const { data: allPosts, error: postsErr } = await admin
          .from("posts")
          .select("id, published_at, reddit_import_id")
          .not("reddit_import_id", "is", null)
          .order("published_at", { ascending: false, nullsFirst: false });
        if (postsErr) {
          return Response.json({ error: postsErr.message }, { status: 500 });
        }
        const posts = ((allPosts ?? []) as any[])
          .filter((p) => !onlyMissing || !alreadyHave.has(p.id))
          .slice(0, limit);

        const { curateAndInsertComments } = await import("@/lib/comment-curation.server");

        const summary = {
          considered: 0,
          skipped_no_source_comments: 0,
          updated: 0,
          comments_inserted: 0,
          errors: [] as string[],
        };

        for (const p of posts) {
          summary.considered++;


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
        }


        return Response.json(summary);
      },
    },
  },
});
