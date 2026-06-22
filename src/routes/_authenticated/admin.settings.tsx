import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: Settings,
});

const DEFAULT_SYSTEM_PROMPT = `You are a senior web producer at WKNA 49 News, a local TV station serving Charleston, West Virginia and the Kanawha Valley.
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

const KEYS = [
  { key: "allow_public_comments", label: "Allow public comment submission", type: "bool", default: false },
  { key: "show_imported_discussion", label: "Show imported discussion comments on articles", type: "bool", default: true },
  { key: "ai_max_comments", label: "Max comments used in AI generation", type: "number", default: 100 },
  { key: "ai_target_length", label: "Default AI article length", type: "text", default: "500-800 words" },
  { key: "ai_system_prompt", label: "AI system prompt (voice & rules)", type: "textarea", default: DEFAULT_SYSTEM_PROMPT, rows: 10 },
  { key: "ai_user_prompt_template", label: "AI user prompt template — supports {{flairHint}} {{title}} {{body}} {{comments}} {{commentsUsed}} {{commentsTotal}}", type: "textarea", default: DEFAULT_USER_TEMPLATE, rows: 16 },
];

function Settings() {
  const q = useQuery({ queryKey: ["settings"], queryFn: async () => (await supabase.from("site_settings").select("*")).data ?? [] });
  const [vals, setVals] = useState<Record<string, any>>({});

  useEffect(() => {
    if (q.data) {
      const map: Record<string, any> = {};
      for (const r of q.data) map[(r as any).key] = (r as any).value;
      setVals(map);
    }
  }, [q.data]);

  const save = async (key: string, value: any) => {
    setVals((v) => ({ ...v, [key]: value }));
    await supabase.from("site_settings").upsert({ key, value });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-black text-primary">Site Settings</h1>
      <div className="space-y-4 rounded-lg border bg-white p-6">
        {KEYS.map((k) => {
          const v = vals[k.key] ?? k.default;
          if (k.type === "bool") return (
            <label key={k.key} className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{k.label}</span>
              <input type="checkbox" checked={!!v} onChange={(e) => save(k.key, e.target.checked)} />
            </label>
          );
          if (k.type === "number") return (
            <label key={k.key} className="block">
              <span className="text-sm font-semibold">{k.label}</span>
              <input type="number" value={v ?? ""} onChange={(e) => save(k.key, Number(e.target.value))} className="mt-1 h-10 w-full rounded border px-3 text-sm" />
            </label>
          );
          return (
            <label key={k.key} className="block">
              <span className="text-sm font-semibold">{k.label}</span>
              <input value={v ?? ""} onChange={(e) => save(k.key, e.target.value)} className="mt-1 h-10 w-full rounded border px-3 text-sm" />
            </label>
          );
        })}
      </div>
    </div>
  );
}
