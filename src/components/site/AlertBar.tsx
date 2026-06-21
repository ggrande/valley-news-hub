export function AlertBar() {
  return (
    <div className="bg-[color:var(--breaking)] text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-1.5 text-xs sm:text-sm">
        <span className="shrink-0 rounded-sm bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
          Weather Alert
        </span>
        <p className="truncate">
          Scattered thunderstorms possible across the Kanawha Valley this afternoon — stay with WKNA 49 Weather.
        </p>
      </div>
    </div>
  );
}
