import { Radio, Loader2 } from "lucide-react";

export function LivePlayer({ large = false }: { large?: boolean }) {
  return (
    <div
      className={
        "relative overflow-hidden rounded-lg bg-[color:var(--navy-dark)] text-white shadow-md " +
        (large ? "aspect-video" : "aspect-video")
      }
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15), transparent 60%), radial-gradient(circle at 70% 70%, rgba(212,178,102,0.2), transparent 60%)",
        }}
      />
      {/* Subtle scanlines for a "stuck stream" vibe */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 3px)",
        }}
        aria-hidden="true"
      />
      <div className="mountain-line absolute inset-x-0 bottom-0 h-10 opacity-60" aria-hidden="true" />
      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--breaking)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em]">
          <span className="size-1.5 animate-pulse rounded-full bg-white" />
          Live
        </span>

        <div className="mt-5 flex size-16 items-center justify-center" aria-label="Buffering">
          <Loader2 className="size-12 animate-spin text-white/90" strokeWidth={2.5} />
        </div>

        <p className="mt-5 font-display text-xl font-bold">Buffering…</p>
        <p className="mt-1 max-w-md text-sm text-white/75">
          <Radio className="mr-1 inline size-3.5" />
          Connecting to the WKNA 49 live stream. Please stand by.
        </p>

        {/* Indeterminate buffer bar */}
        <div className="mt-4 h-1 w-56 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-1/3 animate-[buffer-slide_1.6s_ease-in-out_infinite] rounded-full bg-white/70" />
        </div>
      </div>

      <style>{`
        @keyframes buffer-slide {
          0%   { transform: translateX(-120%); }
          50%  { transform: translateX(110%); }
          100% { transform: translateX(310%); }
        }
      `}</style>
    </div>
  );
}
