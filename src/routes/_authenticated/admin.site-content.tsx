import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/site-content")({
  head: () => ({ meta: [{ title: "Site Content — WKNA 49 Admin" }, { name: "robots", content: "noindex" }] }),
  component: SiteContentAdmin,
});

type Row = { key: string; value: any };

const GROUPS: { title: string; description: string; keys: string[] }[] = [
  { title: "Branding", description: "Station name, tagline, logos, colors.", keys: ["branding"] },
  { title: "Contact & Legal", description: "Emails, address, legal entity.", keys: ["contact"] },
  { title: "Social Links", description: "Public social profiles.", keys: ["social_links"] },
  { title: "Support / Donations", description: "Buy Me a Coffee, crypto wallets.", keys: ["support"] },
  { title: "Alert Bar", description: "Site-wide breaking notice.", keys: ["alert_bar"] },
  { title: "Live Player", description: "Live stream embed URL.", keys: ["live_player"] },
  {
    title: "Pages",
    description: "About, policies, careers — title, meta description, and Markdown body.",
    keys: [
      "page_about",
      "page_privacy_policy",
      "page_terms_of_use",
      "page_accessibility",
      "page_corrections_policy",
      "page_careers",
    ],
  },
];

function SiteContentAdmin() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin_site_content"],
    queryFn: async (): Promise<Row[]> => {
      const { data } = await supabase.from("site_content").select("key,value").order("key");
      return (data ?? []) as Row[];
    },
  });

  const initial = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of q.data ?? []) m[r.key] = JSON.stringify(r.value, null, 2);
    return m;
  }, [q.data]);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(initial);
  }, [initial]);

  const save = async (key: string) => {
    const raw = drafts[key] ?? "";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (e: any) {
      toast.error(`Invalid JSON for ${key}: ${e.message}`);
      return;
    }
    setSaving(key);
    const { error } = await supabase
      .from("site_content")
      .upsert({ key, value: parsed }, { onConflict: "key" });
    setSaving(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Saved ${key}`);
    qc.invalidateQueries({ queryKey: ["site_content"] });
    qc.invalidateQueries({ queryKey: ["admin_site_content"] });
  };

  const known = new Set(GROUPS.flatMap((g) => g.keys));
  const orphans = (q.data ?? []).filter((r) => !known.has(r.key));

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-black text-primary">Site Content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Editable per-site branding, contact info, and page copy. Each block stores JSON — edit the values
          and save. Pages that read these keys will update automatically.
        </p>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {GROUPS.map((g) => (
        <section key={g.title} className="rounded-lg border bg-white p-5">
          <h2 className="font-display text-xl font-bold text-primary">{g.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{g.description}</p>
          <div className="mt-4 space-y-4">
            {g.keys.map((k) => (
              <div key={k}>
                <div className="mb-1 flex items-center justify-between">
                  <code className="text-xs font-semibold text-[color:var(--broadcast)]">{k}</code>
                  <button
                    type="button"
                    onClick={() => save(k)}
                    disabled={saving === k || drafts[k] === initial[k]}
                    className="h-7 rounded-md bg-[color:var(--breaking)] px-3 text-xs font-semibold text-white hover:bg-[color:var(--breaking)]/90 disabled:opacity-50"
                  >
                    {saving === k ? "Saving…" : "Save"}
                  </button>
                </div>
                <textarea
                  value={drafts[k] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))}
                  rows={Math.min(20, Math.max(4, (drafts[k]?.split("\n").length ?? 4)))}
                  spellCheck={false}
                  className="w-full rounded border px-3 py-2 font-mono text-xs"
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      {orphans.length > 0 && (
        <section className="rounded-lg border bg-white p-5">
          <h2 className="font-display text-xl font-bold text-primary">Other keys</h2>
          <div className="mt-4 space-y-4">
            {orphans.map((r) => (
              <div key={r.key}>
                <div className="mb-1 flex items-center justify-between">
                  <code className="text-xs font-semibold text-[color:var(--broadcast)]">{r.key}</code>
                  <button
                    type="button"
                    onClick={() => save(r.key)}
                    disabled={saving === r.key || drafts[r.key] === initial[r.key]}
                    className="h-7 rounded-md bg-[color:var(--breaking)] px-3 text-xs font-semibold text-white hover:bg-[color:var(--breaking)]/90 disabled:opacity-50"
                  >
                    {saving === r.key ? "Saving…" : "Save"}
                  </button>
                </div>
                <textarea
                  value={drafts[r.key] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [r.key]: e.target.value }))}
                  rows={8}
                  spellCheck={false}
                  className="w-full rounded border px-3 py-2 font-mono text-xs"
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
