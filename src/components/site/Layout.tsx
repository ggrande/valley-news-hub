import type { ReactNode } from "react";
import { AlertBar } from "./AlertBar";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AlertBar />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <section className="border-b bg-[color:var(--ivory)]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
        {eyebrow && (
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--broadcast)]">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-4xl font-black tracking-tight text-primary sm:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-4 max-w-2xl font-news text-lg text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </section>
  );
}
