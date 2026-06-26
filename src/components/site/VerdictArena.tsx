// Verdict Arena — sticky tug-of-war panel for controversial articles.
import { useEffect, useRef, useState } from "react";
import { Coins, TrendingUp, Zap } from "lucide-react";
import { castVote, getBattleState } from "@/lib/verdict.functions";
import { getBrowserFingerprint } from "@/lib/verdict-fingerprint";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type TickerRow = { side: "keep" | "remove"; credits: number; label: string; is_ghost: boolean; created_at: string };
type State = {
  battle: any;
  ticker: TickerRow[];
  yourBalance: number | null;
  yourVotesInBattle: number;
  yourKeepCost: number;
  yourRemoveCost: number;
};

export function VerdictArena({ postId, postSlug }: { postId: string; postSlug: string }) {
  const [state, setState] = useState<State | null>(null);
  const [shake, setShake] = useState<"keep" | "remove" | null>(null);
  const [pulse, setPulse] = useState<{ side: "keep" | "remove"; credits: number; whale: boolean } | null>(null);
  const refresh = useRef<() => void>(() => {});

  const load = async () => {
    const fp = getBrowserFingerprint();
    const r: any = await (getBattleState as any)({ data: { postId, fingerprint: fp } });
    if (r?.disabled || !r?.battle) { setState(null); return; }
    setState(r);
  };
  refresh.current = load;

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // Realtime updates
  useEffect(() => {
    if (!state?.battle?.battle_id) return;
    const channel = supabase.channel(`battle:${state.battle.battle_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "verdict_votes", filter: `battle_id=eq.${state.battle.battle_id}` }, () => {
        refresh.current();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [state?.battle?.battle_id]);

  if (!state?.battle) return null;
  const b = state.battle;
  const total = (b.keep_credits ?? 0) + (b.remove_credits ?? 0);
  const keepPct = total > 0 ? (b.keep_credits / total) * 100 : 50;
  const decided = b.status === "decided";

  const vote = async (side: "keep" | "remove") => {
    const cost = side === "keep" ? state.yourKeepCost : state.yourRemoveCost;
    if (state.yourBalance != null && state.yourBalance < cost) {
      toast.error(`Need ${cost} credits — you have ${state.yourBalance}. Claim your daily 50 from the header.`);
      return;
    }
    const r: any = await (castVote as any)({ data: { battleId: b.battle_id, side, fingerprint: getBrowserFingerprint() } });
    if (r?.error) { toast.error(r.error); return; }
    setShake(side);
    setPulse({ side, credits: r.charged, whale: r.charged >= 500 });
    setTimeout(() => setShake(null), 400);
    setTimeout(() => setPulse(null), 1800);
    await load();
  };

  return (
    <section className="mx-auto my-6 max-w-3xl px-4">
      <div className={`rounded-xl border-2 border-primary/20 bg-gradient-to-br from-[color:var(--ivory)] to-white p-5 shadow-lg ${shake === "keep" ? "animate-[shake-left_400ms]" : shake === "remove" ? "animate-[shake-right_400ms]" : ""}`}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground">⚖️ Verdict Arena</span>
            <span className="text-xs text-muted-foreground">Community decides this story's fate</span>
          </div>
          {decided && (
            <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${b.winner === "remove" ? "bg-[color:var(--breaking)] text-white" : "bg-[color:var(--gold)] text-[color:var(--navy-dark)]"}`}>
              {b.winner?.toUpperCase()} WON
            </span>
          )}
        </div>

        {/* Rope/bar */}
        <div className="relative h-12 overflow-hidden rounded-full bg-muted shadow-inner">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--gold)]/70 transition-[width] duration-500 ease-out"
            style={{ width: `${keepPct}%` }}
          />
          <div className="absolute inset-y-0 right-0 bg-gradient-to-l from-[color:var(--breaking)] to-[color:var(--breaking)]/70 transition-[width] duration-500 ease-out"
            style={{ width: `${100 - keepPct}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-between px-4 text-xs font-bold">
            <span className="text-[color:var(--navy-dark)]">KEEP {b.keep_credits.toLocaleString()}</span>
            <span className="text-white drop-shadow">REMOVE {b.remove_credits.toLocaleString()}</span>
          </div>
          {pulse && (
            <div className={`pointer-events-none absolute inset-0 flex items-center justify-center text-2xl font-black ${pulse.side === "keep" ? "text-[color:var(--navy-dark)]" : "text-white"} animate-[pop_1.8s_ease-out]`}>
              {pulse.whale && <Zap className="mr-1 size-7" />}+{pulse.credits}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <TrendingUp className="size-3.5" />
          <span>
            {decided
              ? `Decided ${b.decided_at ? new Date(b.decided_at).toLocaleString() : ""}`
              : b.current_lead_side
                ? `${b.current_lead_side.toUpperCase()} needs to hold a ${b.lead_threshold}-credit lead for ${Math.ceil(b.momentum_window_sec / 60)} min to win`
                : "Tied — make your move."}
          </span>
          <span className="ml-auto">{b.participant_count} voters</span>
        </div>

        {!decided && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => vote("keep")}
              className="group flex flex-col items-center rounded-lg border-2 border-[color:var(--gold)] bg-[color:var(--gold)]/10 p-3 transition-all hover:scale-[1.02] hover:bg-[color:var(--gold)]/25"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--navy-dark)]">Keep it up</span>
              <span className="mt-1 flex items-center gap-1 font-display text-lg font-black text-[color:var(--navy-dark)]">
                <Coins className="size-4" /> {state.yourKeepCost}
              </span>
            </button>
            <button
              onClick={() => vote("remove")}
              className="group flex flex-col items-center rounded-lg border-2 border-[color:var(--breaking)] bg-[color:var(--breaking)]/10 p-3 transition-all hover:scale-[1.02] hover:bg-[color:var(--breaking)]/25"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--breaking)]">Take it down</span>
              <span className="mt-1 flex items-center gap-1 font-display text-lg font-black text-[color:var(--breaking)]">
                <Coins className="size-4" /> {state.yourRemoveCost}
              </span>
            </button>
          </div>
        )}

        {/* Ticker */}
        {state.ticker.length > 0 && (
          <div className="mt-4 max-h-24 overflow-y-auto rounded border bg-white/60 p-2 text-[11px] text-muted-foreground">
            {state.ticker.slice(0, 10).map((t, i) => (
              <div key={i} className="flex justify-between py-0.5">
                <span>
                  <span className={t.side === "keep" ? "text-[color:var(--navy-dark)] font-semibold" : "text-[color:var(--breaking)] font-semibold"}>{t.side === "keep" ? "▲ KEEP" : "▼ REMOVE"}</span>
                  <span className="ml-2">{t.label}</span>
                  {t.is_ghost && <span className="ml-1 opacity-60">·</span>}
                </span>
                <span className="font-mono">+{t.credits}</span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-[10px] text-muted-foreground">
          Your balance: <strong>{state.yourBalance ?? "—"}</strong> credits.
          {" "}Cost rises with each vote and the side you're stacking. Winners get a 10% dividend.
        </p>
      </div>
      {/* Keyframes via inline style tag */}
      <style>{`
        @keyframes shake-left { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(2px)} }
        @keyframes shake-right { 0%,100%{transform:translateX(0)} 25%{transform:translateX(6px)} 75%{transform:translateX(-2px)} }
        @keyframes pop { 0%{transform:scale(0.5);opacity:0} 20%{transform:scale(1.4);opacity:1} 100%{transform:scale(1);opacity:0} }
      `}</style>
      <input type="hidden" value={postSlug} />
    </section>
  );
}
