import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/submissions")({
  component: Submissions,
});

const TABS = [
  { key: "news_tips", label: "News Tips" },
  { key: "community_events", label: "Community Events" },
  { key: "contact_submissions", label: "Contact" },
  { key: "ad_inquiries", label: "Ad Inquiries" },
  { key: "newsletters", label: "Newsletter" },
] as const;

function Submissions() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("news_tips");
  const q = useQuery({
    queryKey: ["sub", tab],
    queryFn: async () => (await supabase.from(tab).select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-black text-primary">Submissions</h1>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`rounded border px-3 py-2 text-xs font-semibold uppercase ${tab === t.key ? "bg-primary text-primary-foreground" : ""}`}>{t.label}</button>
        ))}
      </div>
      <div className="space-y-3">
        {q.data?.map((r: any) => (
          <details key={r.id} className="rounded-lg border bg-white p-4">
            <summary className="cursor-pointer text-sm">
              <span className="font-semibold text-primary">{r.name ?? r.title ?? r.email ?? r.company ?? "Item"}</span>
              <span className="ml-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
            </summary>
            <pre className="mt-3 max-h-64 overflow-auto rounded bg-slate-50 p-3 text-xs whitespace-pre-wrap">{JSON.stringify(r, null, 2)}</pre>
            {tab === "community_events" && !r.is_approved && (
              <button onClick={async () => { await supabase.from("community_events").update({ is_approved: true }).eq("id", r.id); q.refetch(); }} className="mt-2 rounded bg-emerald-700 px-3 py-1 text-xs font-semibold text-white">Approve</button>
            )}
          </details>
        ))}
        {q.data?.length === 0 && <p className="text-muted-foreground">No submissions.</p>}
      </div>
    </div>
  );
}
