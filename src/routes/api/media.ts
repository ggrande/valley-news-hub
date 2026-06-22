import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Streams images from the private news-media bucket using the service role.
// We expose only `news-media/<path>` content. Used for AI-generated article hero images.
export const Route = createFileRoute("/api/media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get("p");
        if (!path || path.includes("..")) return new Response("Bad request", { status: 400 });

        const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const { data, error } = await admin.storage.from("news-media").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });

        const buf = await data.arrayBuffer();
        const ct = (data as any).type || guessType(path);
        return new Response(buf, {
          headers: {
            "Content-Type": ct,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});

function guessType(p: string) {
  const ext = p.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}
