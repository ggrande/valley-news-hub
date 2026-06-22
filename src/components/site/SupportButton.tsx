import { useState } from "react";
import { Heart, Coffee, Copy, Check, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// TODO: replace with the station's actual Buy Me a Coffee username.
const BMC_USERNAME = "wknatv";
const BMC_URL = `https://www.buymeacoffee.com/${BMC_USERNAME}`;

const CRYPTO_WALLETS: { label: string; address: string; note?: string }[] = [
  {
    label: "EVM (ETH / Base / Polygon / Arbitrum)",
    address: "0xE348aD2C679F7b5A5Dd1f68fEc8875f11860795c",
    note: "Send only ERC-20 / EVM-compatible assets.",
  },
];

type Variant = "primary" | "ghost" | "navy" | "inline" | "block";

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    "inline-flex h-9 items-center gap-2 rounded-md bg-[color:var(--breaking)] px-3 text-sm font-semibold uppercase tracking-wide text-white hover:bg-[color:var(--breaking)]/90",
  navy:
    "inline-flex h-9 items-center gap-2 rounded-md border border-[color:var(--gold)]/60 bg-white/5 px-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--gold)] hover:bg-white/10",
  ghost:
    "inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--breaking)] hover:underline",
  inline:
    "inline-flex h-10 items-center gap-2 rounded-md bg-[color:var(--breaking)] px-4 text-sm font-semibold text-white hover:bg-[color:var(--breaking)]/90",
  block:
    "inline-flex w-full items-center justify-center gap-2 rounded-md bg-[color:var(--breaking)] px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white hover:bg-[color:var(--breaking)]/90",
};

export function SupportButton({
  variant = "primary",
  label = "Support WKNA 49",
  className = "",
}: {
  variant?: Variant;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={`${VARIANT_CLASS[variant]} ${className}`} aria-label={label}>
          <Heart className="size-4" aria-hidden="true" />
          {label}
        </button>
      </DialogTrigger>
      <SupportDialogBody />
    </Dialog>
  );
}

function SupportDialogBody() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(addr);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* noop */
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl text-primary">Support WKNA 49</DialogTitle>
        <DialogDescription>
          Independent local journalism for the Kanawha Valley. Every contribution helps us cover Charleston news,
          weather, and high-school sports.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        <a
          href={BMC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-lg bg-[#FFDD00] px-4 py-3 text-[#1a1a1a] shadow-sm transition hover:brightness-95"
        >
          <span className="flex items-center gap-2 font-semibold">
            <Coffee className="size-5" />
            Fuel our journalism
          </span>
          <ExternalLink className="size-4 opacity-70" />
        </a>

        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--broadcast)]">
            Or send crypto
          </p>
          <ul className="space-y-3">
            {CRYPTO_WALLETS.map((w) => (
              <li key={w.address}>
                <p className="text-xs font-semibold text-primary">{w.label}</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">{w.address}</code>
                  <button
                    type="button"
                    onClick={() => copy(w.address)}
                    className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-semibold hover:bg-accent"
                    aria-label={`Copy ${w.label} address`}
                  >
                    {copied === w.address ? (
                      <>
                        <Check className="size-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" /> Copy
                      </>
                    )}
                  </button>
                </div>
                {w.note && <p className="mt-1 text-[11px] text-muted-foreground">{w.note}</p>}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-muted-foreground">
          WKNA 49 News is an independent local news outlet. Contributions are not tax-deductible.
        </p>
      </div>
    </DialogContent>
  );
}
