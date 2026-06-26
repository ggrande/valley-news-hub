// Header wallet badge — shows balance, daily-claim, and top-up trigger.
// Only mounts when Verdict Arena is enabled.
import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { getWallet, claimDailyCredits } from "@/lib/verdict.functions";
import { getBrowserFingerprint } from "@/lib/verdict-fingerprint";
import { useSettingEnabled } from "@/lib/use-verdict-enabled";

export function WalletBadge() {
  const enabled = useSettingEnabled();
  const [balance, setBalance] = useState<number | null>(null);
  const [canClaim, setCanClaim] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const fp = getBrowserFingerprint();
    (getWallet as any)({ data: { fingerprint: fp } })
      .then((r: any) => {
        if (r?.disabled) return;
        setBalance(r.balance);
        setCanClaim(r.canClaim);
      })
      .catch(() => {});
  }, [enabled]);

  if (!enabled) return null;

  const claim = async () => {
    setBusy(true);
    try {
      const r: any = await (claimDailyCredits as any)({ data: { fingerprint: getBrowserFingerprint() } });
      if (r?.balance != null) setBalance(r.balance);
      setCanClaim(false);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-2 rounded-md bg-[color:var(--gold)]/15 px-2.5 py-1.5 text-xs">
      <Coins className="size-4 text-[color:var(--gold)]" />
      <span className="font-bold text-white">{balance ?? "—"}</span>
      {canClaim && (
        <button
          type="button"
          onClick={claim}
          disabled={busy}
          className="ml-1 rounded bg-[color:var(--gold)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--navy-dark)] hover:bg-[color:var(--gold)]/90 disabled:opacity-50"
        >
          {busy ? "…" : "Claim 50"}
        </button>
      )}
    </div>
  );
}
