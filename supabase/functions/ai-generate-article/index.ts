// Generate a local-TV-style article from a Reddit intake using Lovable AI.
// Auth: requires a signed-in admin (verified against user_roles).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const SYSTEM = `You are a local TV news web copy editor for WKNA 49 News, a station serving Charleston, West Virginia and the Kanawha Valley.
Write polished, direct, factual local-news-style web copy. NEVER use Reddit slang. NEVER say "Reddit users said". Treat the source material as community discussion.
Attribute uncertain claims carefully. Avoid unsupported accusations. Use phrases like "According to the original post...", "Several commenters added...", "The discussion centered on...", "One recurring concern was...".
Sound like a real local newsroom. No AI-style language. No phrases like "as an AI". Do NOT include headlines like "Breaking News:" unless instructed.`;

interface Body {
  reddit_import_id: string;
  variation?: "default" | "shorter" | "fuller" | "tv_tone" | "breaking" | "community";
}

function buildPrompt(post: any, comments: any[], variation: string, maxComments: number, targetLength: string) {
  const used = comments.slice(0, maxComments);
  const commentText = used.map((c, i) => `[${i + 1}] (${c.display_name ?? "user"}, score ${c.score ?? 0}, depth ${c.nesting_level ?? 0}): ${c.body}`).join("\n");

  let tone = `Target length: ${targetLength}. Standard local-TV web style.`;
  if (variation === "shorter") tone = "Target length: 250-400 words. Tighter, summary-style.";
  if (variation === "fuller") tone = "Target length: 800-1200 words. More context and quotes.";
  if (variation === "tv_tone") tone = "Target length: 500-800 words. Strongly emphasize local-TV anchor-script cadence.";
  if (variation === "breaking") tone = "Target length: 250-450 words. Treat as a developing breaking-news web story; cautious, factual, no speculation.";
  if (variation === "community") tone = "Target length: 600-900 words. Community-feature angle, warm and human.";

  return `${tone}

Source title: ${post.original_title ?? ""}
Subreddit: r/${post.subreddit ?? "unknown"}
Source body:
${post.original_body ?? "(no body text)"}

Community comments (${used.length} of ${comments.length} used):
${commentText || "(none)"}

Produce a JSON object with EXACTLY these fields:
{
  "headline": "...",
  "seo_title": "...",
  "seo_description": "...",
  "dek": "...",
  "category": "Local|Weather|Sports|Community|Education|Traffic|Business|Breaking",
  "tags": ["..."],
  "body": "multi-paragraph article body, plain text with paragraph breaks (\\n\\n)",
  "suggested_image_prompt": "...",
  "related_story_ideas": ["..."],
  "verification_notes": "admin-only notes on what could not be verified",
  "comment_summary": "admin-only summary of community discussion",
  "risk_flags": ["..."]
}

Respond ONLY with valid JSON. No markdown, no commentary.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "Admin required" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });

    const { reddit_import_id, variation = "default" } = (await req.json()) as Body;
    if (!reddit_import_id) return new Response(JSON.stringify({ error: "reddit_import_id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const { data: imp, error: impErr } = await admin.from("reddit_imports").select("*").eq("id", reddit_import_id).maybeSingle();
    if (impErr || !imp) return new Response(JSON.stringify({ error: "Import not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });

    const { data: comments } = await admin.from("reddit_import_comments").select("*").eq("reddit_import_id", reddit_import_id).order("nesting_level").order("created_at");

    const { data: maxC } = await admin.from("site_settings").select("value").eq("key", "ai_max_comments").maybeSingle();
    const { data: tgtL } = await admin.from("site_settings").select("value").eq("key", "ai_target_length").maybeSingle();
    const maxComments = typeof maxC?.value === "number" ? maxC.value : 100;
    const targetLength = typeof tgtL?.value === "string" ? tgtL.value : "500-800 words";

    const prompt = buildPrompt(imp, comments ?? [], variation, maxComments, targetLength);
    const model = "google/gemini-3-flash-preview";

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in your workspace." }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
    if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: `AI gateway error: ${aiRes.status}`, detail: txt.slice(0, 500) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { body: raw, headline: imp.original_title ?? "Untitled" }; }

    await admin.from("ai_generation_logs").insert({
      reddit_import_id,
      prompt,
      model,
      variation,
      result: parsed,
      created_by: userData.user.id,
    });

    return new Response(JSON.stringify({ ok: true, generated: parsed }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
