import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { listMyLicenses, getMyLicenseDownloadUrl } from "@/lib/network-licenses.functions";
import { Copy, Download, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account/licenses")({
  component: AccountLicensesPage,
});

function AccountLicensesPage() {
  const fetchLicenses = useServerFn(listMyLicenses);
  const requestDownload = useServerFn(getMyLicenseDownloadUrl);
  const qc = useQueryClient();

  const { data: licenses = [], isLoading } = useQuery({
    queryKey: ["my-licenses"],
    queryFn: () => fetchLicenses(),
  });

  const downloadMut = useMutation({
    mutationFn: (licenseId: string) => requestDownload({ data: { licenseId } }),
    onSuccess: (res) => {
      toast.success(`Download ready (v${res.version})`);
      window.open(res.url, "_blank");
      qc.invalidateQueries({ queryKey: ["my-licenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Licenses</h1>
        <p className="text-muted-foreground mt-1">
          Self-host license keys, downloads, and update history.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : licenses.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-muted-foreground">You don't have any licenses yet.</p>
            <Button asChild>
              <a href="/network">
                Browse the Network <ExternalLink className="h-4 w-4 ml-1" />
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        licenses.map((lic) => (
          <Card key={lic.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="font-mono text-base break-all">{lic.license_key}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{lic.email}</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <Badge variant={lic.revoked ? "destructive" : "default"}>
                  {lic.revoked ? "Revoked" : "Active"}
                </Badge>
                <Badge variant="outline">{lic.channel}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Stat label="Current version" value={lic.current_version ?? "—"} />
                <Stat label="Downloads" value={`${lic.downloads_used} / ${lic.downloads_max}`} />
                <Stat
                  label="Last check"
                  value={lic.last_check_at ? new Date(lic.last_check_at).toLocaleString() : "Never"}
                />
                <Stat label="Issued" value={new Date(lic.created_at).toLocaleDateString()} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(lic.license_key);
                    toast.success("License key copied");
                  }}
                >
                  <Copy className="h-4 w-4 mr-1" /> Copy key
                </Button>
                <Button
                  size="sm"
                  disabled={lic.revoked || downloadMut.isPending}
                  onClick={() => downloadMut.mutate(lic.id)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  {downloadMut.isPending ? "Preparing…" : "Download latest"}
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href="/network/changelog">View changelog</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs uppercase tracking-wide">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
