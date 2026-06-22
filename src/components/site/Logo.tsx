export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src="/logo-rect.png"
      alt="WKNA 49 News"
      width={compact ? 160 : 220}
      height={compact ? 57 : 79}
      className={compact ? "h-10 w-auto" : "h-12 w-auto sm:h-14"}
      decoding="async"
    />
  );
}
