import { Radio, Play } from "lucide-react";

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
      <div className="mountain-line absolute inset-x-0 bottom-0 h-10 opacity-60" aria-hidden="true" />
      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--breaking)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em]">
          <span className="size-1.5 animate-pulse rounded-full bg-white" />
          Live
        </span>
        <button
          type="button"
          className="mt-5 inline-flex size-16 items-center justify-center rounded-full bg-white/95 text-[color:var(--navy-dark)] shadow-lg transition hover:scale-105"
          aria-label="Play live stream"
        >
          <Play className="size-7 fill-current" />
        </button>
        <p className="mt-5 font-display text-xl font-bold">WKNA 49 News — Live Stream</p>
        <p className="mt-1 max-w-md text-sm text-white/75">
          <Radio className="mr-1 inline size-3.5" />
          Live coverage appears here during scheduled newscasts, breaking news, severe weather, and special events.
        </p>
      </div>
    </div>
  );
}
