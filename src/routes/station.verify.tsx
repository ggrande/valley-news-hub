import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { verifyStationLogin } from "@/lib/tenant-auth.functions";

export const Route = createFileRoute("/station/verify")({
  head: () => ({ meta: [{ title: "Verifying…" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) || "" }),
  component: VerifyPage,
});

function VerifyPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const verifyFn = useServerFn(verifyStationLogin);
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => verifyFn({ data: { token } }),
    onSuccess: () => navigate({ to: "/station/admin", replace: true }),
    onError: (e: Error) => setError(e.message),
  });

  useEffect(() => {
    if (token && !mut.isPending && !mut.data && !error) mut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full rounded-lg border bg-card p-8 text-center shadow-sm">
        {!token ? (
          <p className="text-sm text-red-700">Missing token.</p>
        ) : error ? (
          <>
            <h1 className="font-display text-xl font-bold text-red-700">{error}</h1>
            <a href="/station/admin" className="mt-3 inline-block text-sm text-primary underline">
              Request a new link →
            </a>
          </>
        ) : (
          <>
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}
