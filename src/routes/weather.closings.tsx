import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, School, Building2, Briefcase, Info } from "lucide-react";

type ClosingRow = {
  id: string;
  name: string;
  type: "school" | "government" | "business" | "other";
  status: "closed" | "delayed" | "early_dismissal" | "virtual" | "normal";
  county: string | null;
  note: string | null;
  effective_date: string;
  expires_at: string | null;
  updated_at: string;
};

export const Route = createFileRoute("/weather/closings")({
  head: () => ({
    meta: [
      { title: "WV School Closings & Delays — Kanawha Valley | WKNA 49" },
      { name: "description", content: "Live tracker of West Virginia school closings, delays, and early dismissals across Kanawha County and the Kanawha Valley from WKNA 49 Weather." },
      { property: "og:title", content: "WV School Closings & Delays — WKNA 49 Tracker" },
      { property: "og:description", content: "Real-time school, government, and business closings and delays across the Kanawha Valley." },
      { property: "og:url", content: "/weather/closings" },
    ],
    links: [{ rel: "canonical", href: "/weather/closings" }],
  }),
  component: ClosingsPage,
});

const STATUS_LABEL: Record<ClosingRow["status"], string> = {
  closed: "Closed",
  delayed: "Delayed",
  early_dismissal: "Early Dismissal",
  virtual: "Virtual",
  normal: "Normal",
};

const STATUS_TONE: Record<ClosingRow["status"], string> = {
  closed: "bg-[color:var(--breaking)] text-white",
  delayed: "bg-[color:var(--gold)] text-[color:var(--navy-dark)]",
  early_dismissal: "bg-[color:var(--broadcast)] text-white",
  virtual: "bg-primary text-primary-foreground",
  normal: "bg-muted text-muted-foreground",
};

const TYPE_ICON = {
  school: School,
  government: Building2,
  business: Briefcase,
  other: Info,
} as const;

function ClosingsPage() {
  const q = useQuery({
    queryKey: ["closings-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("closings" as never)
        .select("*")
        .order("type", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ClosingRow[];
    },
    refetchInterval: 60_000,
  });

  const rows = q.data ?? [];
  const groups = {
    school: rows.filter((r) => r.type === "school"),
    government: rows.filter((r) => r.type === "government"),
    business: rows.filter((r) => r.type === "business"),
    other: rows.filter((r) => r.type === "other"),
  };
  const lastUpdated = rows.reduce<string | null>((acc, r) => (acc && acc > r.updated_at ? acc : r.updated_at), null);

  return (
    <Layout>
      <PageHeader
        eyebrow="WKNA 49 Weather"
        title="WV School Closings & Delays"
        description="School, government, and business closings across Kanawha County and the Kanawha Valley. Updated continuously during severe weather."
      />
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-[color:var(--navy-dark)] p-4 text-white">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 text-[color:var(--gold)]" />
            {rows.length === 0
              ? "No active closings or delays reported."
              : `${rows.length} active ${rows.length === 1 ? "report" : "reports"}`}
          </p>
          <p className="text-xs text-white/70">
            {lastUpdated ? `Last updated ${new Date(lastUpdated).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}` : "Auto-refreshes every minute"}
          </p>
        </div>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading closings…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border bg-card p-10 text-center">
            <School className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-3 font-display text-xl font-bold text-primary">All clear in the Kanawha Valley</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              There are no active school, government, or business closings. We'll update this page as soon as schools and county offices report changes.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {(Object.entries(groups) as [keyof typeof groups, ClosingRow[]][]).map(([type, list]) =>
              list.length === 0 ? null : (
                <Group key={type} type={type} list={list} />
              )
            )}
          </div>
        )}

        <div className="mt-10 rounded-lg border bg-[color:var(--ivory)] p-5 text-sm text-muted-foreground">
          <p className="font-semibold text-primary">Report a closing</p>
          <p className="mt-1">
            School and county officials can email closings to{" "}
            <a href="mailto:weather@wkna49.com" className="text-[color:var(--broadcast)] underline">
              weather@wkna49.com
            </a>{" "}
            for fastest posting.
          </p>
        </div>
      </section>
    </Layout>
  );
}

function Group({ type, list }: { type: keyof typeof TYPE_ICON; list: ClosingRow[] }) {
  const Icon = TYPE_ICON[type];
  const label = type === "school" ? "Schools" : type === "government" ? "Government & Public Offices" : type === "business" ? "Businesses" : "Other";
  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 border-b-2 border-primary pb-2 font-display text-xl font-black text-primary">
        <Icon className="size-5" />
        {label}
        <span className="ml-2 text-xs font-semibold text-muted-foreground">({list.length})</span>
      </h2>
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--ivory)] text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">County</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 font-semibold text-primary">{r.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{r.county ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${STATUS_TONE[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{r.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
