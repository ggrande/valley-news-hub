import { useSiteContent } from "@/lib/use-site-content";
import { useTenant } from "@/lib/use-tenant";

export function Logo({ compact = false }: { compact?: boolean }) {
  const branding = useSiteContent<{ logo_url: string; name: string }>("branding", {
    logo_url: "/logo-rect.png",
    name: "WKNA 49 News",
  });
  const { tenant } = useTenant();
  const logoUrl = tenant?.logoUrl || branding.logo_url || "/logo-rect.png";
  const name = tenant?.displayName || branding.name || "WKNA 49 News";
  return (
    <img
      src={logoUrl}
      alt={name}
      width={compact ? 160 : 220}
      height={compact ? 57 : 79}
      className={compact ? "h-10 w-auto" : "h-12 w-auto sm:h-14"}
      decoding="async"
    />
  );
}
