// Shared core for generating a single article. Used by both the admin server fn
// and the cron-driven processor endpoint. SERVER-ONLY (loads service-role client).
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SYSTEM = `You are a senior web producer at WKNA 49 News, a local TV station serving Charleston, West Virginia and the Kanawha Valley.
You turn raw community discussions into polished, factual local-news-style web articles.
Voice: direct, declarative, AP-style. NEVER use Reddit slang. NEVER mention Reddit, subreddits, upvotes, or commenters as "redditors". Treat the source material as community discussion or reader correspondence.
Attribute uncertain claims carefully. Avoid unsupported accusations or naming private individuals.
Sound like a real local newsroom. No AI-style language.`;

const BLOCKLIST = [
  /\bkill\s+(?:myself|yourself|himself|herself)\b/i,
  /\bsuicide\s+(?:method|how to)\b/i,
  /\bchild\s+(?:porn|sexual)\b/i,
  /\bhow\s+to\s+make\s+(?:a\s+)?bomb\b/i,
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

async function callAi(prompt: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
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
  if (!res.ok) throw new Error(`AI gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const raw = j?.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(raw); } catch { return { body: raw }; }
}

export async function generateOne(admin: SupabaseClient, importId: string) {
  const { data: imp, error } = await admin.from("reddit_imports").select("*").eq("id", importId).single();
  if (error || !imp) throw new Error("Import not found");

  const comments = (imp.parsed_comments as any[] | null) ?? [];
  const usedComments = comments.slice(0, 60);
  const commentText = usedComments
    .map((c, i) => `[${i + 1}] (${c.author ?? "user"}, score ${c.score ?? 0}): ${c.body}`)
    .join("\n");
  const flairHint = imp.link_flair_text
    ? `Category hint (from source tagging): "${imp.link_flair_text}". Use it when reasonable.`
    : "Pick the best fit category as a short noun phrase.";

  const prompt = `${flairHint}

Source title: ${imp.original_title ?? ""}
Source body:
${imp.original_body ?? "(no body text)"}

Community discussion (${usedComments.length} of ${comments.length} used):
${commentText || "(none)"}

Produce JSON with EXACTLY these fields:
{ "headline": "...", "seo_title": "...", "seo_description": "max 160 chars", "dek": "subhead",
  "category": "short noun phrase", "tags": ["..."], "body": "multi-paragraph plain text with \\n\\n",
  "hero_caption": "short caption", "verification_notes": "admin-only", "comment_summary": "admin-only",
  "risk_flags": ["minors","self-harm","doxxing","legal accusations","medical advice"] }

Respond ONLY with valid JSON.`;

  let generated: any;
  try { generated = await callAi(prompt); }
  catch (err: any) {
    await admin.from("reddit_imports").update({ processing_error: String(err?.message ?? err) }).eq("id", imp.id);
    throw err;
  }

  // Category
  let categoryId: string | null = null;
  const catName = (generated.category ?? imp.link_flair_text ?? "Community").toString().trim();
  if (catName) {
    const catSlug = slugify(catName);
    const { data: existingCat } = await admin.from("categories").select("id").eq("slug", catSlug).maybeSingle();
    if (existingCat) categoryId = existingCat.id;
    else {
      const { data: newCat } = await admin.from("categories").insert({ slug: catSlug, name: catName }).select("id").single();
      categoryId = newCat?.id ?? null;
    }
  }

  // Slug
  let baseSlug = slugify(generated.headline || imp.original_title || "story");
  if (!baseSlug) baseSlug = `story-${imp.reddit_post_id}`;
  let slug = baseSlug;
  let n = 1;
  while (true) {
    const { data: clash } = await admin.from("posts").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    n++;
    slug = `${baseSlug}-${n}`;
    if (n > 25) { slug = `${baseSlug}-${imp.reddit_post_id?.slice(0, 6) ?? Date.now()}`; break; }
  }

  const firstMedia = (imp.media_paths as string[] | null)?.[0] ?? null;
  const featuredImage = firstMedia ? `/api/media?p=${encodeURIComponent(firstMedia)}` : null;

  const fullText = `${generated.headline ?? ""}\n${generated.body ?? ""}`;
  const detReasons = BLOCKLIST.filter((re) => re.test(fullText)).map((re) => ({ source: "deterministic", reason: re.source }));
  const riskFlags = Array.isArray(generated.risk_flags) ? generated.risk_flags : [];
  const moderationStatus = detReasons.length > 0 ? "blocked" : riskFlags.length > 0 ? "review" : "clear";
  const moderationReasons = [
    ...detReasons,
    ...riskFlags.map((r: string) => ({ source: "ai_risk_flag", reason: r })),
  ];

  const { data: post, error: postErr } = await admin
    .from("posts")
    .insert({
      slug,
      title: generated.headline ?? imp.original_title ?? "Untitled",
      dek: generated.dek ?? null,
      body: (generated.body ?? "").toString(),
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
      published_at: imp.original_created_at,
      reddit_import_id: imp.id,
      generated_version: "v1",
    })
    .select("id")
    .single();
  if (postErr || !post) throw new Error(postErr?.message ?? "post insert failed");

  if (Array.isArray(generated.tags)) {
    for (const t of generated.tags.slice(0, 8)) {
      const tagSlug = slugify(String(t));
      if (!tagSlug) continue;
      const { data: tagRow } = await admin.from("tags").upsert({ slug: tagSlug, name: String(t) }, { onConflict: "slug" }).select("id").single();
      if (tagRow) await admin.from("post_tags").upsert({ post_id: post.id, tag_id: tagRow.id });
    }
  }

  await admin.from("ai_generation_logs").insert({
    reddit_import_id: imp.id,
    post_id: post.id,
    prompt,
    model: "google/gemini-3-flash-preview",
    variation: "default",
    result: generated,
  });

  await admin
    .from("reddit_imports")
    .update({
      import_status: "generated",
      generated_post_id: post.id,
      moderation_status: moderationStatus,
      moderation_reasons: moderationReasons,
      processing_error: null,
    })
    .eq("id", imp.id);

  return { postId: post.id, moderationStatus };
}
