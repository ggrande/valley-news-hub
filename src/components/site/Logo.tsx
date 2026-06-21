export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="tower-mark h-10 w-8 shrink-0"
        aria-hidden="true"
      />
      <div className="flex flex-col leading-none">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-2xl font-black tracking-tight text-primary-foreground">
            WKNA
          </span>
          <span className="rounded-sm bg-[color:var(--gold)] px-1.5 py-0.5 font-display text-sm font-black tracking-tight text-[color:var(--navy-dark)]">
            49
          </span>
          {!compact && (
            <span className="font-display text-xl font-semibold tracking-tight text-primary-foreground/95">
              News
            </span>
          )}
        </div>
        {!compact && (
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
            Charleston's Channel 49
          </span>
        )}
      </div>
    </div>
  );
}
