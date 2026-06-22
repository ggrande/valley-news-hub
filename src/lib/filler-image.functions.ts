import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Generates a stylized editorial filler image for a post using the Lovable AI gateway,
// uploads it to the news-media bucket, and sets featured_image/og_image.
export const generateFillerImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { postId: string; force?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: post, error: pErr } = await supabaseAdmin
      .from("posts")
      .select("id, title, dek, featured_image, category:categories(name)")
      .eq("id", data.postId)
      .maybeSingle();
    if (pErr || !post) throw new Error(pErr?.message ?? "post not found");
    if (post.featured_image && !data.force) return { ok: true, skipped: true, url: post.featured_image };

    const cat = (post as any).category?.name ?? "news";
    const prompt = [
      `Editorial newspaper-style illustration for a satirical news article.`,
      `Headline: "${post.title}".`,
      post.dek ? `Subhead: "${post.dek}".` : "",
      `Category: ${cat}.`,
      `Style: muted gritty halftone newsprint, warm desaturated palette, painterly editorial, no text, no logos, no watermarks, no captions, no UI, photo-illustration composition suitable as a hero image, 16:9 framing.`,
    ].filter(Boolean).join(" ");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        modalities: ["image", "text"],
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI image error ${res.status}: ${t.slice(0, 300)}`);
    }
    const json: any = await res.json();
    const images: any[] = json?.choices?.[0]?.message?.images ?? [];
    const url0: string | undefined = images[0]?.image_url?.url;
    if (!url0 || !url0.startsWith("data:")) throw new Error("no image returned");
    const [meta, b64] = url0.split(",");
    const mime = /data:([^;]+);/.exec(meta)?.[1] ?? "image/png";
    const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    const path = `filler/${post.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("news-media")
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (upErr) throw upErr;

    const heroUrl = `/api/media?p=${encodeURIComponent(path)}`;
    const { error: updErr } = await supabaseAdmin
      .from("posts")
      .update({ featured_image: heroUrl, og_image: heroUrl })
      .eq("id", post.id);
    if (updErr) throw updErr;

    return { ok: true, url: heroUrl };
  });
