import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM = `You are a senior web producer at WKNA 49 News, a local TV station serving Charleston, West Virginia and the Kanawha Valley.
You turn raw community discussions into polished, factual local-news-style web articles.
Voice: direct, declarative, AP-style. NEVER use Reddit slang. NEVER mention Reddit, subreddits, upvotes, or commenters as "redditors". Treat the source material as community discussion or reader correspondence.
Attribute uncertain claims carefully ("according to the original account", "several readers wrote", "the discussion centered on"). Avoid unsupported accusations or naming private individuals.
Sound like a real local newsroom. No AI-style language. No phrases like "as an AI". Do not include label prefixes like "Breaking News:" in the headline.`;

const BLOCKLIST = [
  /\bkill\s+(?:myself|yourself|himself|herself)\b/i,
  /\bsuicide\s+(?:method|how to)\b/i,
  /\bchild\s+(?:porn|sexual)\b/i,
  /\bhow\s+to\s+make\s+(?:a\s+)?bomb\b/i,
];

function deterministicModeration(text: string): string[] {
  const reasons: string[] = [];
  for (const re of BLOCKLIST) if (re.test(text)) reasons.push(`matched blocklist: ${re.source}`);
  return reasons;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function callAi(prompt: string, apiKey: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 402) throw new Error("AI credits exhausted");
  if (res.status === 429) throw new Error("Rate limited; try again shortly");
  if (!res.ok) throw new Error(`AI gateway error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const raw = j?.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(raw); } catch { return { body: raw }; }
}

export const generateArticleFromImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { importId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!roleRow) throw new Response("Forbidden", { status: 403 });

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: imp, error: impErr } = await supabaseAdmin
      .from("reddit_imports")
      .select("*")
      .eq("id", data.importId)
      .single();
    if (impErr || !imp) throw new Error("Import not found");

    const comments = (imp.parsed_comments as any[] | null) ?? [];
    const usedComments = comments.slice(0, 60);
    const commentText = usedComments
      .map((c, i) => `[${i + 1}] (${c.author ?? "user"}, score ${c.score ?? 0}): ${c.body}`)
      .join("\n");

    const flairHint = imp.link_flair_text
      ? `Category hint (from source tagging): "${imp.link_flair_text}". Use it when reasonable.`
      : "No category hint provided. Pick the best fit from: Local, Community, Education, Science, Business, Weather, Sports, Traffic.";

    const prompt = `${flairHint}

Source title: ${imp.original_title ?? ""}
Source body:
${imp.original_body ?? "(no body text)"}

Community discussion (${usedComments.length} of ${comments.length} used):
${commentText || "(none)"}

Produce a JSON object with EXACTLY these fields:
{
  "headline": "...",
  "seo_title": "...",
  "seo_description": "max 160 chars",
  "dek": "one-sentence subheadline",
  "category": "best-fit category as a short noun phrase, e.g. Community, Education, Science",
  "tags": ["..."],
  "body": "multi-paragraph article body, plain text with paragraph breaks (\\n\\n)",
  "hero_caption": "short photo caption",
  "verification_notes": "admin-only: what could not be independently verified",
  "comment_summary": "admin-only: 1-2 sentences summarizing community discussion",
  "risk_flags": ["any sensitive topics: minors, self-harm, doxxing, legal accusations, medical advice"]
}

Respond ONLY with valid JSON. No markdown.`;

    let generated: any;
    try {
      generated = await callAi(prompt, apiKey);
    } catch (err: any) {
      await supabaseAdmin
        .from("reddit_imports")
        .update({ processing_error: String(err?.message ?? err) })
        .eq("id", imp.id);
      throw err;
    }

    // Resolve category by name (create if missing)
    let categoryId: string | null = null;
    const catName = (generated.category ?? imp.link_flair_text ?? "Community").toString().trim();
    if (catName) {
      const catSlug = slugify(catName);
      const { data: existingCat } = await supabaseAdmin
        .from("categories")
        .select("id")
        .eq("slug", catSlug)
        .maybeSingle();
      if (existingCat) {
        categoryId = existingCat.id;
      } else {
        const { data: newCat } = await supabaseAdmin
          .from("categories")
          .insert({ slug: catSlug, name: catName })
          .select("id")
          .single();
        categoryId = newCat?.id ?? null;
      }
    }

    // Unique slug
    let baseSlug = slugify(generated.headline || imp.original_title || "story");
    if (!baseSlug) baseSlug = `story-${imp.reddit_post_id}`;
    let slug = baseSlug;
    let n = 1;
    while (true) {
      const { data: clash } = await supabaseAdmin.from("posts").select("id").eq("slug", slug).maybeSingle();
      if (!clash) break;
      n++;
      slug = `${baseSlug}-${n}`;
      if (n > 25) { slug = `${baseSlug}-${imp.reddit_post_id?.slice(0, 6) ?? Date.now()}`; break; }
    }

    // Featured image via media proxy
    const firstMedia = (imp.media_paths as string[] | null)?.[0] ?? null;
    const featuredImage = firstMedia ? `/api/media?p=${encodeURIComponent(firstMedia)}` : null;

    // Deterministic moderation
    const fullText = `${generated.headline ?? ""}\n${generated.body ?? ""}`;
    const detReasons = deterministicModeration(fullText);
    const riskFlags = Array.isArray(generated.risk_flags) ? generated.risk_flags : [];
    const moderationReasons = [
      ...detReasons.map((r) => ({ source: "deterministic", reason: r })),
      ...riskFlags.map((r: string) => ({ source: "ai_risk_flag", reason: r })),
    ];
    const moderationStatus = detReasons.length > 0 ? "blocked" : riskFlags.length > 0 ? "review" : "clear";

    // Create draft post (never auto-publish per spec)
    const body = (generated.body ?? "").toString();
    const { data: post, error: postErr } = await supabaseAdmin
      .from("posts")
      .insert({
        slug,
        title: generated.headline ?? imp.original_title ?? "Untitled",
        dek: generated.dek ?? null,
        body,
        status: "draft",
        source_type: "reddit_import",
        source_url: imp.permalink,
        source_subreddit: imp.subreddit,
        source_post_id: imp.reddit_post_id,
        original_source_title: imp.original_title,
        original_source_body: imp.original_body,
        original_permalink: imp.permalink,
        original_flair: imp.link_flair_text,
        category_id: categoryId,
        featured_image: featuredImage,
        hero_caption: generated.hero_caption ?? null,
        seo_title: generated.seo_title ?? null,
        seo_description: generated.seo_description ?? null,
        og_image: featuredImage,
        verification_notes: generated.verification_notes ?? null,
        editor_notes: generated.comment_summary ?? null,
        published_at: imp.original_created_at, // preserve original timestamp; gates on status=published
        reddit_import_id: imp.id,
        created_by: context.userId,
        generated_version: "v1",
      })
      .select("id")
      .single();
    if (postErr || !post) throw new Error(postErr?.message ?? "Could not create post");

    // Tags
    if (Array.isArray(generated.tags) && generated.tags.length) {
      for (const tagName of generated.tags.slice(0, 8)) {
        const tagSlug = slugify(String(tagName));
        if (!tagSlug) continue;
        const { data: tagRow } = await supabaseAdmin
          .from("tags")
          .upsert({ slug: tagSlug, name: String(tagName) }, { onConflict: "slug" })
          .select("id")
          .single();
        if (tagRow) await supabaseAdmin.from("post_tags").upsert({ post_id: post.id, tag_id: tagRow.id });
      }
    }

    // Log
    await supabaseAdmin.from("ai_generation_logs").insert({
      reddit_import_id: imp.id,
      post_id: post.id,
      prompt,
      model: "google/gemini-3-flash-preview",
      variation: "default",
      result: generated,
      created_by: context.userId,
    });

    // Update import
    await supabaseAdmin
      .from("reddit_imports")
      .update({
        import_status: "generated",
        generated_post_id: post.id,
        moderation_status: moderationStatus,
        moderation_reasons: moderationReasons,
        processing_error: null,
      })
      .eq("id", imp.id);

    return { postId: post.id, moderationStatus, moderationReasons };
  });

export const drainBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { batchId: string; limit?: number }) => input)
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!roleRow) throw new Response("Forbidden", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("reddit_imports")
      .select("id")
      .eq("batch_id", data.batchId)
      .eq("import_status", "new")
      .limit(data.limit ?? 5);

    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const r of rows ?? []) {
      try {
        // Call self via direct fn call would re-check auth; just inline
        await (generateArticleFromImport as any)({ data: { importId: r.id } });
        results.push({ id: r.id, ok: true });
      } catch (err: any) {
        results.push({ id: r.id, ok: false, error: String(err?.message ?? err) });
      }
    }
    return { processed: results.length, results };
  });
