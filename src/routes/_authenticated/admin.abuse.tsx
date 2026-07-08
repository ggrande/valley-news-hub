import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listAbuseReports, updateAbuseReport } from "@/lib/abuse-reports.functions";

export const Route = createFileRoute("/_authenticated/admin/abuse")({
  head: () => ({ meta: [{ title: "Abuse Reports · Admin" }, { name: "robots", content: "noindex" }] }),
  component: AbuseQueuePage,
});

function AbuseQueuePage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAbuseReports);
  const updateFn = useServerFn(updateAbuseReport);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const q = useQuery({
    queryKey: ["abuse-reports", statusFilter],
    queryFn: () => listFn({ data: { status: statusFilter || undefined } }),
  });
  const mut = useMutation({
    mutationFn: (v: { id: string; status?: string; admin_notes?: string | null }) => updateFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["abuse-reports"] }),
    onError: (e: Error) => alert(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="font-display text-3xl font-black text-primary">Abuse reports</h1>
      <p className="mt-1 text-sm text-muted-foreground">Reader-submitted reports on tenant content.</p>

      <div className="mt-4 flex gap-2">
        {["open", "reviewing", "actioned", "dismissed", ""].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md border px-3 py-1 text-xs font-semibold capitalize ${
              statusFilter === s ? "bg-primary text-primary-foreground" : ""
            }`}
          >
            {s || "all"}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {(q.data?.reports ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No reports.</p>
        )}
        {(q.data?.reports ?? []).map((r: any) => (
          <div key={r.id} className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded px-2 py-0.5 font-semibold ${
                    r.status === "open" ? "bg-yellow-100 text-yellow-800"
                    : r.status === "actioned" ? "bg-red-100 text-red-800"
                    : r.status === "dismissed" ? "bg-gray-100 text-gray-700"
                    : "bg-blue-100 text-blue-800"
                  }`}>{r.status}</span>
                  <span className="rounded bg-muted px-2 py-0.5 font-mono">{r.target_kind}</span>
                  <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-2 font-semibold">{r.reason}</p>
                {r.details && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{r.details}</p>}
                <div className="mt-2 space-y-0.5 text-xs">
                  {r.target_url && (
                    <div><a href={r.target_url} className="text-primary underline" target="_blank" rel="noreferrer">{r.target_url}</a></div>
                  )}
                  <div className="font-mono text-muted-foreground">target_id: {r.target_id}</div>
                  {r.reporter_email && <div className="text-muted-foreground">from: {r.reporter_email}</div>}
                  {r.managed_site_id && <div className="font-mono text-muted-foreground">site: {r.managed_site_id}</div>}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {r.status !== "reviewing" && (
                  <button onClick={() => mut.mutate({ id: r.id, status: "reviewing" })}
                          className="rounded border px-3 py-1 text-xs font-semibold">Reviewing</button>
                )}
                {r.status !== "actioned" && (
                  <button onClick={() => mut.mutate({ id: r.id, status: "actioned" })}
                          className="rounded border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">Actioned</button>
                )}
                {r.status !== "dismissed" && (
                  <button onClick={() => mut.mutate({ id: r.id, status: "dismissed" })}
                          className="rounded border px-3 py-1 text-xs font-semibold">Dismiss</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
