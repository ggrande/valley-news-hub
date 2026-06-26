import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { ensureWebStoryUploaded, publicStoryUrl } from "@/lib/web-story.server";

// Google Web Stories (AMP). The canonical Web Story URL lives on
// GitHub Pages (Supabase Storage forces text/plain + x-robots-tag: none
// + restrictive CSP, breaking AMP). On hit, ensure the file is committed
// to the docs/ folder and 302 to the Pages URL.
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
