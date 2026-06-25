import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { adminListLicenses, setLicenseRevoked } from "@/lib/network-licenses.functions";

export const Route = createFileRoute("/_authenticated/admin/licenses")({
  component: AdminLicensesPage,
});

function AdminLicensesPage() {
  const fetchLicenses = useServerFn(adminListLicenses);
  const revoke = useServerFn(setLicenseRevoked);
  const qc = useQueryClient();

  const { data: licenses = [], isLoading } = useQuery({
    queryKey: ["admin-licenses"],
    queryFn: () => fetchLicenses(),
  });

  const revokeMut = useMutation({
    mutationFn: (vars: { id: string; revoked: boolean }) => revoke({ data: vars }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-licenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Network Licenses</h1>
        <p className="text-muted-foreground mt-1">All issued self-host license keys.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Licenses ({licenses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Downloads</TableHead>
                  <TableHead>Last Check</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licenses.map((lic) => (
                  <TableRow key={lic.id}>
                    <TableCell className="font-mono text-xs">{lic.license_key}</TableCell>
                    <TableCell className="text-sm">{lic.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{lic.channel}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{lic.current_version ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {lic.downloads_used} / {lic.downloads_max}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lic.last_check_at ? new Date(lic.last_check_at).toLocaleString() : "Never"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={lic.revoked ? "destructive" : "default"}>
                        {lic.revoked ? "Revoked" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={lic.revoked ? "outline" : "destructive"}
                        disabled={revokeMut.isPending}
                        onClick={() => revokeMut.mutate({ id: lic.id, revoked: !lic.revoked })}
                      >
                        {lic.revoked ? "Reinstate" : "Revoke"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
