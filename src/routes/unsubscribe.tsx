import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Layout } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) || "" }),
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: "Unsubscribe — WKNA 49" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type State = "loading" | "valid" | "invalid" | "already" | "submitting" | "done" | "error";

function UnsubscribePage() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setState("invalid");
          return;
        }
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setState("already");
        } else if (data.valid) {
          setState("valid");
        } else {
          setState("invalid");
        }
      })
      .catch(() => setState("invalid"));
  }, [token]);

  const confirm = async () => {
    setState("submitting");
    setError(null);
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error || "Could not process unsubscribe");
        setState("error");
        return;
      }
      if (data.success || data.reason === "already_unsubscribed") {
        setState("done");
      } else {
        setError(data.error || "Could not process unsubscribe");
        setState("error");
      }
    } catch (e: any) {
      setError(e?.message || "Network error");
      setState("error");
    }
  };

  return (
    <Layout>
      <div className="container max-w-xl py-12">
        <Card>
          <CardHeader>
            <CardTitle>Unsubscribe from WKNA 49 emails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {state === "loading" && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking your link…
              </div>
            )}
            {state === "valid" && (
              <>
                <p>Click the button below to stop receiving emails from WKNA 49.</p>
                <Button onClick={confirm}>Confirm unsubscribe</Button>
              </>
            )}
            {state === "submitting" && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Processing…
              </div>
            )}
            {state === "done" && (
              <p className="text-green-700">
                You've been unsubscribed. We're sorry to see you go.
              </p>
            )}
            {state === "already" && (
              <p className="text-muted-foreground">
                This email address is already unsubscribed.
              </p>
            )}
            {state === "invalid" && (
              <p className="text-destructive">
                This unsubscribe link is invalid or has expired.
              </p>
            )}
            {state === "error" && (
              <p className="text-destructive">{error || "Something went wrong."}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
