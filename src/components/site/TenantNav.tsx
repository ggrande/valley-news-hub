import type { TenantSite } from "@/lib/use-tenant-site";

// TenantNav is now rendered by the shared Layout via TenantHeader, so this
// component is a no-op kept for backward compatibility with existing imports.
export function TenantNav(_props: { tenant: TenantSite; active?: string }) {
  return null;
}

export function TenantHeader({ tenant, eyebrow, title, description }: {
  tenant: TenantSite;
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <section className="border-b bg-[color:var(--ivory)]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--broadcast)]">
          {eyebrow ?? `${tenant?.displayName ?? "Station"} · Affiliate of WKNA 49`}
        </p>
        <h1 className="mt-1 font-display text-3xl font-black text-primary sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </div>
    </section>
  );
}
