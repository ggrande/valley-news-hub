import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Layout } from "../components/site/Layout";

function NotFoundComponent() {
  return (
    <Layout>
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--breaking)]">Error 404</p>
        <h1 className="mt-3 font-display text-5xl font-black text-primary">Page not found</h1>
        <p className="mt-3 text-muted-foreground">
          The page you're looking for isn't part of WKNA49.com. Try the homepage or our latest news.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Go home</Link>
          <Link to="/news" className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-semibold">Latest news</Link>
        </div>
      </div>
    </Layout>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <Layout>
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-primary">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try refreshing or head back home.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Try again</button>
          <a href="/" className="h-10 rounded-md border px-4 py-2 text-sm font-semibold">Go home</a>
        </div>
      </div>
    </Layout>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "WKNA 49 News — Local News for the Kanawha Valley" },
      { name: "description", content: "WKNA-TV 49 — Charleston's Channel 49. Local news, weather, sports, and live coverage from the Kanawha Valley." },
      { name: "author", content: "WKNA-TV 49" },
      { name: "theme-color", content: "#101a3a" },
      { name: "google-site-verification", content: "PSEI_2pt6EH5BpztOnh3uzr-p8oFsur94EyiBq8rI88" },
      { property: "og:site_name", content: "WKNA 49 News" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "WKNA 49 News — Local News for the Kanawha Valley" },
      { name: "twitter:title", content: "WKNA 49 News — Local News for the Kanawha Valley" },
      { property: "og:description", content: "WKNA-TV 49 — Charleston's Channel 49. Local news, weather, sports, and live coverage from the Kanawha Valley." },
      { name: "twitter:description", content: "WKNA-TV 49 — Charleston's Channel 49. Local news, weather, sports, and live coverage from the Kanawha Valley." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/423ff38d-1525-4183-9e13-5cd353f92abb/id-preview-81d154c2--354111e0-8b0b-4250-b183-df5baf2db5bd.lovable.app-1782104617433.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/423ff38d-1525-4183-9e13-5cd353f92abb/id-preview-81d154c2--354111e0-8b0b-4250-b183-df5baf2db5bd.lovable.app-1782104617433.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800;900&family=Source+Serif+4:wght@400;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
