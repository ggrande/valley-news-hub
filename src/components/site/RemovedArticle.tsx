// Removed-by-public-verdict article placeholder. Renders block characters in
// place of paragraphs; preserves the page URL so the verdict tally is shareable.
import { Link } from "@tanstack/react-router";
import { Layout } from "./Layout";

function blockify(text: string): string {
  return text.replace(/[a-zA-Z0-9]/g, "█").replace(/\s/g, " ");
}

export function RemovedArticle({
  title, dek, originalBody, keep, remove, decidedAt,
}: {
  title: string;
  dek?: string | null;
  originalBody?: string | null;
  keep: number;
  remove: number;
  decidedAt?: string | null;
}) {
  const paragraphs = (originalBody ?? "").split(/\n\n+/).filter(Boolean);
  const total = keep + remove;
  const removePct = total > 0 ? Math.round((remove / total) * 100) : 100;

  return (
    <Layout>
      <article>
        <div className="border-b-4 border-[color:var(--breaking)] bg-[color:var(--breaking)]/10">
          <div className="mx-auto max-w-3xl px-4 py-12">
            <span className="inline-flex items-center gap-2 rounded bg-[color:var(--breaking)] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">
              ⚖️ Removed by public verdict
            </span>
            <h1 className="mt-4 font-display text-3xl font-black tracking-tight text-primary sm:text-4xl">
              {blockify(title)}
            </h1>
            {dek && <p className="mt-3 font-news text-lg text-muted-foreground">{blockify(dek)}</p>}
            <div className="mt-6 rounded-lg border-2 border-[color:var(--breaking)]/30 bg-white p-4">
              <p className="text-sm font-semibold text-primary">The community voted to remove this story.</p>
              <div className="mt-3 flex items-center gap-3 text-xs">
                <span className="rounded bg-[color:var(--gold)]/20 px-2 py-1 font-semibold">KEEP: {keep.toLocaleString()}</span>
                <span className="rounded bg-[color:var(--breaking)]/20 px-2 py-1 font-semibold">REMOVE: {remove.toLocaleString()}</span>
                <span className="text-muted-foreground">({removePct}% remove)</span>
              </div>
              {decidedAt && <p className="mt-2 text-xs text-muted-foreground">Decided {new Date(decidedAt).toLocaleString()}</p>}
              <p className="mt-3 text-xs text-muted-foreground">
                Verdict Arena lets readers spend credits to keep or remove featured stories.
                The original article text has been redacted.
                {" "}<Link to="/about" className="underline">Learn more</Link>.
              </p>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-2xl px-4 py-10 font-news text-lg leading-relaxed text-foreground/50 select-none">
          {paragraphs.map((p, i) => (
            <p key={i} className="mb-5 break-words">{blockify(p)}</p>
          ))}
        </div>
      </article>
    </Layout>
  );
}
