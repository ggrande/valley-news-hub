import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminListManagedSites, adminStageReleaseForSites, type ManagedSiteRow } from "@/lib/managed-sites.functions";
import { listAllReleases } from "@/lib/network-releases.functions";

export const Route = createFileRoute("/_authenticated/admin/managed-sites")({
  head: () => ({ meta: [{ title: "Managed Sites — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const list = useServerFn(adminListManagedSites);
  const listReleases = useServerFn(adminListReleases);
  const stage = useServerFn(adminStageReleaseForSites);
  const qc = useQueryClient();

  const { data: sites = [], isLoading } = useQuery({ queryKey: ["admin-managed-sites"], queryFn: () => list() });
  const { data: releases = [] } = useQuery({ queryKey: ["admin-releases-for-staging"], queryFn: () => listReleases() });

  const publishedReleases = releases.filter((r: any) => r.published_at);
  const [selectedRelease, setSelectedRelease] = useState<string>("");

  const stageMut = useMutation({
    mutationFn: (siteId?: string) => stage({ data: { releaseId: selectedRelease, ...(siteId && { siteId }) } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-managed-sites"] }),
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

      <div className="mt-6 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Site</th>
              <th className="px-3 py-2 text-left">Owner</th>
              <th className="px-3 py-2 text-left">Sub status</th>
              <th className="px-3 py-2 text-left">Current</th>
              <th className="px-3 py-2 text-left">Pending</th>
              <th className="px-3 py-2 text-left">Last deploy</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Loading…</td></tr>
            ) : sites.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No managed sites yet.</td></tr>
            ) : sites.map((s: ManagedSiteRow) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-semibold">{s.display_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{s.subdomain}</div>
                  {s.custom_domain && <div className="text-xs text-muted-foreground font-mono">{s.custom_domain}</div>}
                </td>
                <td className="px-3 py-2 text-xs">{s.owner_email}</td>
                <td className="px-3 py-2 text-xs">{s.subscription_status}</td>
                <td className="px-3 py-2 text-xs font-mono">{s.current_release?.version ?? "—"}</td>
                <td className="px-3 py-2 text-xs font-mono">{s.pending_release?.version ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{s.last_deployed_at ? new Date(s.last_deployed_at).toLocaleDateString() : "—"}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => stageMut.mutate(s.id)}
                    disabled={!selectedRelease || stageMut.isPending}
                    className="h-8 rounded border px-3 text-xs font-semibold disabled:opacity-50"
                  >
                    Stage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
