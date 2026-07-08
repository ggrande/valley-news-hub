// Shared core for generating a single article. Used by both the admin server fn
// and the cron-driven processor endpoint. SERVER-ONLY (loads service-role client).
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SYSTEM = `You are a senior web producer at WKNA 49 News, a local TV station serving Charleston, West Virginia and the Kanawha Valley.
You turn raw community discussions into polished, factual local-news-style web articles.
Voice: direct, declarative, AP-style. NEVER use Reddit slang. NEVER mention Reddit, subreddits, upvotes, or commenters as "redditors". Treat the source material as community discussion or reader correspondence.
Attribute uncertain claims carefully. Avoid unsupported accusations or naming private individuals.
Sound like a real local newsroom. No AI-style language.`;

const DEFAULT_USER_TEMPLATE = `{{flairHint}}

Source title: {{title}}
Source body:
{{body}}

Community discussion ({{commentsUsed}} of {{commentsTotal}} used):
{{comments}}

Produce JSON with EXACTLY these fields:
{ "headline": "...", "seo_title": "...", "seo_description": "max 160 chars", "dek": "subhead",
  "category": "short noun phrase", "tags": ["..."], "body": "multi-paragraph plain text with \\n\\n",
  "hero_caption": "short caption", "verification_notes": "admin-only", "comment_summary": "admin-only",
  "risk_flags": ["minors","self-harm","doxxing","legal accusations","medical advice"] }

Respond ONLY with valid JSON.`;

const BLOCKLIST = [
  /\bkill\s+(?:myself|yourself|himself|herself)\b/i,
  /\bsuicide\s+(?:method|how to)\b/i,
  /\bchild\s+(?:porn|sexual)\b/i,
  /\bhow\s+to\s+make\s+(?:a\s+)?bomb\b/i,
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

async function callAi(systemPrompt: string, userText: string, imageDataUrl: string | null) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  // Global master-site AI cap — prevents runaway usage of Lovable AI credits.
  // 30/min, 200/hour, 800/day across all callers of the article generator.
  try {
    const { enforceRateLimit } = await import("@/lib/rate-limit.server");
    await enforceRateLimit({
      scope: "ai-post", key: "master", siteId: null,
      perMinute: 30, perHour: 200, perDay: 800,
    });
  } catch (err) {
    const { captureTenantError } = await import("@/lib/error-capture.server");
    await captureTenantError(null, "ai_quota_post", err);
    throw err;
  }

  const userContent: any = imageDataUrl
    ? [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ]
    : userText;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const err = new Error(`AI gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const { captureTenantError } = await import("@/lib/error-capture.server");
    await captureTenantError(null, "ai_gateway_post", err, { status: res.status });
    throw err;
  }
  const j = await res.json();
  const raw = j?.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(raw); } catch { return { body: raw }; }
}

async function getSetting(admin: SupabaseClient, key: string): Promise<string | null> {
  const { data } = await admin.from("site_settings").select("value").eq("key", key).maybeSingle();
  const v = (data as any)?.value;
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && typeof v.value === "string") return v.value;
  return null;
}

async function loadCandidateImageDataUrl(
  admin: SupabaseClient,
  imp: any,
): Promise<{ dataUrl: string | null; storagePath: string | null; mediaUrl: string | null }> {
  // Prefer the explicit candidate field; fall back to the first archive media file.
  const candidate: string | null = imp.candidate_hero_image_url ?? null;
  const firstMedia = (imp.media_paths as string[] | null)?.[0] ?? null;
  let storagePath: string | null = null;
  let mediaUrl: string | null = null;

  if (candidate) {
    // candidate is stored as `/api/media?p=<path>`; extract the storage path.
    try {
      const u = new URL(candidate, "http://x");
      storagePath = u.searchParams.get("p");
    } catch {
      storagePath = null;
    }
    mediaUrl = candidate;
  } else if (firstMedia) {
    storagePath = firstMedia;
    mediaUrl = `/api/media?p=${encodeURIComponent(firstMedia)}`;
  }

  if (!storagePath) return { dataUrl: null, storagePath: null, mediaUrl: null };

  try {
    const { data, error } = await admin.storage.from("news-media").download(storagePath);
    if (error || !data) return { dataUrl: null, storagePath, mediaUrl };
    const buf = new Uint8Array(await data.arrayBuffer());
    if (buf.length > 6 * 1024 * 1024) return { dataUrl: null, storagePath, mediaUrl }; // skip huge files
    const mime = (data as any).type || "image/jpeg";
    // base64 encode
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    return { dataUrl: `data:${mime};base64,${b64}`, storagePath, mediaUrl };
  } catch {
    return { dataUrl: null, storagePath, mediaUrl };
  }
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

  const systemPrompt = (await getSetting(admin, "ai_system_prompt")) || DEFAULT_SYSTEM;
  const userTemplate = (await getSetting(admin, "ai_user_prompt_template")) || DEFAULT_USER_TEMPLATE;

  const { dataUrl: imageDataUrl, mediaUrl: candidateMediaUrl } = await loadCandidateImageDataUrl(admin, imp);

  const prompt = userTemplate
    .replace(/\{\{flairHint\}\}/g, flairHint)
    .replace(/\{\{title\}\}/g, imp.original_title ?? "")
    .replace(/\{\{body\}\}/g, imp.original_body ?? "(no body text)")
    .replace(/\{\{author\}\}/g, imp.original_author_display ?? "unknown")
    .replace(/\{\{commentsUsed\}\}/g, String(usedComments.length))
    .replace(/\{\{commentsTotal\}\}/g, String(comments.length))
    .replace(/\{\{comments\}\}/g, commentText || "(none)")
    .replace(/\{\{hasImage\}\}/g, imageDataUrl ? "yes" : "no");

  let generated: any;
  try { generated = await callAi(systemPrompt, prompt, imageDataUrl); }
  catch (err: any) {
    await admin.from("reddit_imports").update({ processing_error: String(err?.message ?? err) }).eq("id", imp.id);
    throw err;
  }

  // Category
  let categoryId: string | null = null;
  const catName = (generated.category ?? imp.link_flair_text ?? "Community").toString().trim();
  const generatedBody = (generated.body ?? "").toString().trim();
  const generatedHeadline = (generated.headline ?? "").toString().trim();

  // Hard reject: AI flagged this source as unusable, or returned an empty body, or
  // labeled it as "rejected source material". Don't pollute /admin/posts with empty
  // archived placeholders — mark the import as discarded and return.
  const isRejected =
    /reject/i.test(catName) ||
    /reject/i.test(generatedHeadline) ||
    generatedBody.length < 40;
  if (isRejected) {
    await admin
      .from("reddit_imports")
      .update({
        import_status: "discarded",
        generated_post_id: null,
        processing_error: `Auto-rejected: ${/reject/i.test(catName) ? "category=" + catName : generatedBody.length < 40 ? "empty body" : "headline=" + generatedHeadline}`,
      })
      .eq("id", imp.id);
    return { postId: null, moderationStatus: "rejected" as const, rejected: true };
  }

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

  // Hero image decision from AI
  const heroDecision = String(generated.hero_image_use ?? "").toLowerCase().trim();
  const heroApproved = candidateMediaUrl && /^approved(_with_crop)?$/.test(heroDecision);
  const featuredImage = heroApproved ? candidateMediaUrl : null;

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
      og_image: featuredImage,
      candidate_hero_image_url: candidateMediaUrl,
      hero_image_decision: heroDecision || null,
      hero_image_reason: generated.hero_image_reason ?? null,
      hero_image_alt: generated.hero_image_alt ?? null,
      hero_crop_hint: generated.hero_crop_hint ?? null,
      hero_caption: heroApproved ? (generated.hero_caption ?? null) : null,
      seo_title: generated.seo_title ?? null,
      seo_description: generated.seo_description ?? null,
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

  // Populate the public Reader Discussion thread from the source comments,
  // filtered to in-world chatter only and preserving original timestamps.
  try {
    const { curateAndInsertComments } = await import("./comment-curation.server");
    await curateAndInsertComments(admin, post.id, comments, imp.original_created_at ?? null);
  } catch (err) {
    // Don't fail generation just because comments couldn't be saved.
    console.warn(`comment curation failed for ${post.id}:`, err);
  }

  return { postId: post.id, moderationStatus };
}
