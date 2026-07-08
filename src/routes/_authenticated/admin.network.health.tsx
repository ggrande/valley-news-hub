import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getNetworkHealth } from "@/lib/network-health.functions";

export const Route = createFileRoute("/_authenticated/admin/network/health")({
  head: () => ({ meta: [{ title: "Network Health · Admin" }, { name: "robots", content: "noindex" }] }),
  component: NetworkHealthPage,
});

function NetworkHealthPage() {
  const fn = useServerFn(getNetworkHealth);
  const [hours, setHours] = useState(24);
  const q = useQuery({
    queryKey: ["network-health", hours],
    queryFn: () => fn({ data: { hours } }),
  });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black text-primary">Network health</h1>
          <p className="text-sm text-muted-foreground">Observability for tenant-side server activity.</p>
        </div>
        <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="rounded-md border px-3 py-2 text-sm">
          <option value={1}>Last hour</option>
          <option value={24}>Last 24 hours</option>
          <option value={72}>Last 3 days</option>
          <option value={168}>Last 7 days</option>
          <option value={720}>Last 30 days</option>
        </select>
      </div>

      {q.isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

      {q.data && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Open abuse reports" value={q.data.openAbuseReports} accent={q.data.openAbuseReports > 0 ? "warn" : undefined} />
            <Stat label="Error events" value={(q.data.recentErrors ?? []).length} />
            <Stat label="AI ops (posts)" value={((q.data.aiByOp?.post?.ok ?? 0) + (q.data.aiByOp?.post?.err ?? 0))} />
            <Stat label="AI ops (images)" value={((q.data.aiByOp?.image?.ok ?? 0) + (q.data.aiByOp?.image?.err ?? 0))} />
          </div>

          <Section title="Errors by kind">
            <KVList data={q.data.errorsByKind} empty="No errors recorded." />
          </Section>

          <Section title="Rate-limit hits by scope">
            <KVList data={q.data.rateByScope} empty="No rate-limited endpoints triggered." />
          </Section>

          <Section title="AI usage by op">
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase">
                  <tr><th className="p-2 text-left">Op</th><th className="p-2 text-right">Succeeded</th><th className="p-2 text-right">Failed</th></tr>
                </thead>
                <tbody>
                  {Object.entries(q.data.aiByOp ?? {}).map(([op, v]: any) => (
                    <tr key={op} className="border-t">
                      <td className="p-2 font-mono">{op}</td>
                      <td className="p-2 text-right">{v.ok}</td>
                      <td className={`p-2 text-right ${v.err ? "text-red-700 font-semibold" : ""}`}>{v.err}</td>
                    </tr>
                  ))}
                  {Object.keys(q.data.aiByOp ?? {}).length === 0 && (
                    <tr><td colSpan={3} className="p-3 text-center text-muted-foreground">No AI activity in this window.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={`Recent errors (${(q.data.recentErrors ?? []).length})`}>
            <div className="space-y-2">
              {(q.data.recentErrors ?? []).slice(0, 50).map((e: any) => (
                <div key={e.id} className="rounded-md border bg-card p-3 text-xs">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-mono font-semibold">{e.kind}</span>
                    <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{e.message}</p>
                  {e.managed_site_id && <p className="mt-1 font-mono text-muted-foreground">site: {e.managed_site_id}</p>}
                </div>
              ))}
              {(q.data.recentErrors ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No errors captured. Nice.</p>
              )}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: "warn" }) {
  return (
    <div className={`rounded-lg border p-4 ${accent === "warn" ? "border-yellow-300 bg-yellow-50" : "bg-card"}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-black text-primary">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-semibold text-primary">{title}</h2>
      {children}
    </section>
  );
}

function KVList({ data, empty }: { data: Record<string, number>; empty: string }) {
  const entries = Object.entries(data ?? {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex justify-between rounded border bg-card px-3 py-2 text-sm">
          <span className="font-mono">{k}</span>
          <span className="font-semibold">{v}</span>
        </div>
      ))}
    </div>
  );
}
