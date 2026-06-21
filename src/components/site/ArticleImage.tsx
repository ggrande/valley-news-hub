export function ArticleImage({
  hue,
  label,
  className = "",
}: {
  hue: number;
  label: string;
  className?: string;
}) {
  const a = `hsl(${hue} 45% 28%)`;
  const b = `hsl(${(hue + 35) % 360} 55% 50%)`;
  return (
    <div
      className={
        "relative flex items-end overflow-hidden bg-muted " + className
      }
      style={{ backgroundImage: `linear-gradient(135deg, ${a}, ${b})` }}
      role="img"
      aria-label={label}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 400 240"
        className="absolute inset-0 h-full w-full opacity-30 mix-blend-overlay"
        preserveAspectRatio="none"
      >
        <path
          d="M0 200 L60 170 L110 185 L170 150 L230 175 L290 140 L350 165 L400 145 L400 240 L0 240 Z"
          fill="#ffffff"
          opacity="0.35"
        />
        <path
          d="M0 220 L80 195 L150 210 L220 185 L290 205 L360 190 L400 200 L400 240 L0 240 Z"
          fill="#000000"
          opacity="0.25"
        />
      </svg>
      <div className="relative z-10 w-full bg-gradient-to-t from-black/55 to-transparent p-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
          WKNA 49 News
        </span>
      </div>
    </div>
  );
}
