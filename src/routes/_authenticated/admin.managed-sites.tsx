import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  adminListManagedSites,
  adminStageReleaseForSites,
  adminSetSiteStatus,
  type ManagedSiteRow,
} from "@/lib/managed-sites.functions";
import { listAllReleases } from "@/lib/network-releases.functions";

export const Route = createFileRoute("/_authenticated/admin/managed-sites")({
  head: () => ({ meta: [{ title: "Managed Sites — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800",
    suspended: "bg-rose-100 text-rose-800",
    provisioning: "bg-amber-100 text-amber-800",
    failed: "bg-rose-100 text-rose-800",
  };
  return `inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold ${map[status] ?? "bg-muted text-muted-foreground"}`;
}

function domainBadge(status: string | null) {
  if (!status) return null;
  const map: Record<string, string> = {
    verified: "bg-emerald-100 text-emerald-800",
    pending: "bg-amber-100 text-amber-800",
    failed: "bg-rose-100 text-rose-800",
  };
  return `inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${map[status] ?? "bg-muted text-muted-foreground"}`;
}

function Page() {
  const list = useServerFn(adminListManagedSites);
  const listReleases = useServerFn(listAllReleases);
  const stage = useServerFn(adminStageReleaseForSites);
  const setStatus = useServerFn(adminSetSiteStatus);
  const qc = useQueryClient();

  const { data: sites = [], isLoading } = useQuery({ queryKey: ["admin-managed-sites"], queryFn: () => list() });
  const { data: releases = [] } = useQuery({ queryKey: ["admin-releases-for-staging"], queryFn: () => listReleases() });

  const publishedReleases = releases.filter((r: any) => r.published_at);
  const [selectedRelease, setSelectedRelease] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "active" | "suspended" | "onboarding">("all");

  const stageMut = useMutation({
    mutationFn: (siteId?: string) => stage({ data: { releaseId: selectedRelease, ...(siteId && { siteId }) } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-managed-sites"] }),
  });

  const statusMut = useMutation({
    mutationFn: (v: { siteId: string; status: "active" | "suspended" }) =>
      setStatus({ data: { siteId: v.siteId, status: v.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-managed-sites"] }),
  });

  const filtered = sites.filter((s) => {
    if (filter === "all") return true;
    if (filter === "active") return s.status === "active";
    if (filter === "suspended") return s.status === "suspended";
    if (filter === "onboarding") return !s.onboarding_completed_at;
    return true;
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-black text-primary">Managed Sites</h1>
      <p className="mt-2 text-sm text-muted-foreground">All sites in the Managed Mirror tier across the network.</p>

      <div className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Stage a release</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={selectedRelease}
            onChange={(e) => setSelectedRelease(e.target.value)}
            className="h-9 rounded border px-3 text-sm"
          >
            <option value="">Choose published release…</option>
            {publishedReleases.map((r: any) => (
              <option key={r.id} value={r.id}>
                v{r.version} {r.is_security ? "[security]" : ""} {r.is_breaking ? "[breaking]" : ""}
              </option>
            ))}
          </select>
          <button
            onClick={() => stageMut.mutate(undefined)}
            disabled={!selectedRelease || stageMut.isPending}
            className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Stage for all active sites
          </button>
          {stageMut.data && <span className="text-xs text-muted-foreground">Staged for {(stageMut.data as any).staged ?? 0} sites.</span>}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Security releases auto-deploy to sites that opted in.</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-muted-foreground">Filter:</span>
        {(["all", "active", "suspended", "onboarding"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded border px-2 py-1 ${filter === f ? "bg-primary text-primary-foreground" : "bg-white"}`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-muted-foreground">{filtered.length} of {sites.length}</span>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Site</th>
              <th className="px-3 py-2 text-left">Owner</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Sub</th>
              <th className="px-3 py-2 text-left">Domain</th>
              <th className="px-3 py-2 text-left">Directory</th>
              <th className="px-3 py-2 text-left">Onboarded</th>
              <th className="px-3 py-2 text-left">Current</th>
              <th className="px-3 py-2 text-left">Pending</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">No sites match this filter.</td></tr>
            ) : filtered.map((s: ManagedSiteRow) => (
              <tr key={s.id} className="border-t align-top">
                <td className="px-3 py-2">
                  <div className="font-semibold">{s.display_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{s.subdomain}</div>
                  {s.custom_domain && <div className="text-xs text-muted-foreground font-mono">{s.custom_domain}</div>}
                </td>
                <td className="px-3 py-2 text-xs">{s.owner_email}</td>
                <td className="px-3 py-2"><span className={statusBadge(s.status)}>{s.status}</span></td>
                <td className="px-3 py-2 text-xs">{s.subscription_status}</td>
                <td className="px-3 py-2 text-xs">
                  {s.custom_domain ? (
                    <span className={domainBadge(s.custom_domain_status) ?? ""}>{s.custom_domain_status ?? "—"}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{s.directory_opt_in ? "opted-in" : "—"}</td>
                <td className="px-3 py-2 text-xs">{s.onboarding_completed_at ? "yes" : "no"}</td>
                <td className="px-3 py-2 text-xs font-mono">{s.current_release?.version ?? "—"}</td>
                <td className="px-3 py-2 text-xs font-mono">{s.pending_release?.version ?? "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => stageMut.mutate(s.id)}
                      disabled={!selectedRelease || stageMut.isPending}
                      className="h-7 rounded border px-2 text-[11px] font-semibold disabled:opacity-50"
                    >
                      Stage
                    </button>
                    {s.status === "suspended" ? (
                      <button
                        onClick={() => statusMut.mutate({ siteId: s.id, status: "active" })}
                        disabled={statusMut.isPending}
                        className="h-7 rounded bg-emerald-600 px-2 text-[11px] font-semibold text-white disabled:opacity-50"
                      >
                        Reactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (confirm(`Suspend ${s.display_name}? The site will show a paused page immediately.`)) {
                            statusMut.mutate({ siteId: s.id, status: "suspended" });
                          }
                        }}
                        disabled={statusMut.isPending}
                        className="h-7 rounded border border-rose-300 px-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Suspend
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
