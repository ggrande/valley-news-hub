import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/site/Layout";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff Sign In — WKNA 49 News" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/admin" });
    });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/admin",
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/admin" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="font-display text-3xl font-black text-primary">Staff Sign In</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          WKNA 49 News staff access. The first account created on this site becomes the lead administrator.
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-lg border bg-card p-6">
          <div className="flex gap-2 text-xs font-semibold uppercase tracking-wide">
            <button type="button" onClick={() => setMode("signin")} className={`flex-1 rounded-md border px-3 py-2 ${mode === "signin" ? "bg-primary text-primary-foreground" : ""}`}>Sign In</button>
            <button type="button" onClick={() => setMode("signup")} className={`flex-1 rounded-md border px-3 py-2 ${mode === "signup" ? "bg-primary text-primary-foreground" : ""}`}>Create Account</button>
          </div>
          {mode === "signup" && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-primary">Display Name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-10 w-full rounded-md border px-3 text-sm" />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-primary">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 w-full rounded-md border px-3 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-primary">Password</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-10 w-full rounded-md border px-3 text-sm" />
          </div>
          {error && <p className="text-sm text-[color:var(--breaking)]">{error}</p>}
          <button disabled={busy} type="submit" className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "Working…" : mode === "signup" ? "Create Account" : "Sign In"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">← Back to WKNA49.com</Link>
        </p>
      </div>
    </Layout>
  );
}
