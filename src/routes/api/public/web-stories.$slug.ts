import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { ensureWebStoryUploaded, publicStoryUrl } from "@/lib/web-story.server";

// Google Web Stories (AMP). The canonical Web Story URL is the public
// Supabase Storage URL (no Lovable script rewriter in that path). This route
// is a convenience generator: on hit, it ensures the file is uploaded and
// 302s to the storage URL. Sitemap/links point directly at storage.
export const Route = createFileRoute("/api/public/web-stories/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: post } = await supabase
          .from("posts")
          .select("slug, title, dek, body, published_at, updated_at, featured_image, seo_description, author:authors(name), category:categories(name)")
          .eq("slug", params.slug)
          .eq("status", "published")
          .maybeSingle();

        if (!post) {
          return new Response("Not found", { status: 404 });
        }

        try {
          const url = await ensureWebStoryUploaded(post as any);
          return new Response(null, {
            status: 302,
            headers: { Location: url, "Cache-Control": "public, max-age=300" },
          });
        } catch (err) {
          console.error("[web-stories] upload failed", err);
          return new Response(null, {
            status: 302,
            headers: { Location: publicStoryUrl(params.slug) },
          });
        }
      },
    },
  },
});
