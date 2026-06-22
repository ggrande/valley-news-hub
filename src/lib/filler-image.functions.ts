import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const DEFAULT_FILLER_PROMPT = `Photorealistic editorial news photograph for a local TV news web article.
Headline: "{{title}}".
Subhead: "{{dek}}".
Category: {{category}}.
Style: real-life documentary photojournalism, natural lighting, true-to-life colors, candid composition, shallow depth of field where appropriate, looks like it was captured by a working news photographer with a DSLR. NOT an illustration, NOT a cartoon, NOT a painting, NOT stylized, NOT a render. No text, no logos, no watermarks, no captions, no on-screen graphics. 16:9 framing suitable as a hero image.`;

// Generates a photorealistic filler image for a post using the Lovable AI gateway,
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

    const { data: tmplRow } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", "filler_image_prompt_template")
      .maybeSingle();
    const tmplVal = (tmplRow as any)?.value;
    const rawTmpl =
      typeof tmplVal === "string"
        ? tmplVal
        : tmplVal && typeof tmplVal === "object" && typeof tmplVal.value === "string"
          ? tmplVal.value
          : DEFAULT_FILLER_PROMPT;

    const prompt = rawTmpl
      .replace(/\{\{title\}\}/g, post.title ?? "")
      .replace(/\{\{dek\}\}/g, post.dek ?? "")
      .replace(/\{\{category\}\}/g, cat);

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
