import { useSiteContent } from "@/lib/use-site-content";

export function AlertBar() {
  const alert = useSiteContent<{ enabled: boolean; text: string; label?: string }>("alert_bar", {
    enabled: false,
    text: "",
    label: "Alert",
  });
  if (!alert?.enabled || !alert.text) return null;
  return (
    <div className="bg-[color:var(--breaking)] text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-1.5 text-xs sm:text-sm">
        <span className="shrink-0 rounded-sm bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
          {alert.label || "Alert"}
        </span>
        <p className="truncate">{alert.text}</p>
      </div>
    </div>
  );
}
