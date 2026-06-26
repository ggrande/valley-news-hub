import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/stories/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Web Story — WKNA 49 News` },
      { name: "description", content: "Tap-through visual story from WKNA 49 News." },
      { property: "og:title", content: "Web Story — WKNA 49 News" },
      { property: "og:description", content: "Tap-through visual story from WKNA 49 News." },
      { property: "og:type", content: "article" },
      // Canonical points to the AMP doc on the stories subdomain so Google
      // treats the GitHub-Pages-hosted AMP as the indexable source.
      { tagName: "link", rel: "canonical", href: `https://stories.wkna49.com/web-stories/${params.slug}/` } as any,
    ],
  }),
  component: StoryEmbed,
});

function StoryEmbed() {
  const { slug } = Route.useParams();
  // Hit the trigger endpoint so the AMP doc is (re)generated and committed
  // on demand; it 302s to the canonical stories subdomain URL.
  const src = `/api/public/web-stories/${slug}`;
  return (
    <div className="fixed inset-0 bg-black">
      <iframe
        src={src}
        title="WKNA 49 Web Story"
        allow="autoplay; fullscreen"
        allowFullScreen
        className="h-full w-full border-0"
      />
    </div>
  );
}
