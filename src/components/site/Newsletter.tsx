import { useState } from "react";
import { Mail, Check } from "lucide-react";
import { subscribeNewsletter } from "@/lib/public-submissions.functions";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <section className="rounded-lg border bg-[color:var(--ivory)] p-6 sm:p-8">
      <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--broadcast)]">
            <Mail className="mr-1 inline size-3.5" /> WKNA 49 Newsletter
          </p>
          <h3 className="mt-2 font-display text-2xl font-black text-primary">The Kanawha Valley Daily</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Top local headlines, weather, and what's happening in the valley — delivered each weekday morning.
          </p>
        </div>
        {done ? (
          <p className="inline-flex items-center gap-2 rounded-md bg-[color:var(--gold)]/30 px-4 py-2 text-sm font-semibold text-[color:var(--navy-dark)]">
            <Check className="size-4" /> You're subscribed — thanks!
          </p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!email) return;
              setBusy(true); setErr(null);
              try {
                await subscribeNewsletter({ data: { email } });
                setDone(true);
              } catch (ex: any) {
                setErr(ex?.message ?? "Subscription failed");
              } finally {
                setBusy(false);
              }
            }}
            className="flex w-full max-w-md gap-2"
          >
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" aria-label="Email address" className="h-10 flex-1 rounded-md border bg-background px-3 text-sm focus:border-[color:var(--broadcast)] focus:outline-none" />
            <button type="submit" disabled={busy} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">{busy ? "…" : "Subscribe"}</button>
          </form>
        )}
      </div>
      {err && <p className="mt-2 text-xs text-[color:var(--breaking)]">{err}</p>}
    </section>
  );
}
