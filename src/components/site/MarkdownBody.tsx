import { Fragment, type ReactNode } from "react";

/**
 * Tiny dependency-free markdown renderer for CMS body fields.
 * Supports: `## heading`, blank-line paragraphs, `[text](url)` links,
 * `**bold**`, and `*italic*`. Anything more should be added later.
 */
export function MarkdownBody({ source }: { source: string }) {
  if (!source?.trim()) return null;
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={i} className="mt-8 font-display text-2xl font-bold text-primary">
              {renderInline(trimmed.slice(3))}
            </h2>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h1 key={i} className="mt-8 font-display text-3xl font-black text-primary">
              {renderInline(trimmed.slice(2))}
            </h1>
          );
        }
        return (
          <p key={i} className="mt-4">
            {renderInline(trimmed)}
          </p>
        );
      })}
    </>
  );
}

function renderInline(text: string) {
  // Links [text](url)
  const parts: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) {
      parts.push(
        <a key={idx++} href={m[2]} className="text-[color:var(--broadcast)] underline">
          {m[1]}
        </a>,
      );
    } else if (m[3]) {
      parts.push(<strong key={idx++}>{m[3]}</strong>);
    } else if (m[4]) {
      parts.push(<em key={idx++}>{m[4]}</em>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.map((p, i) => <Fragment key={i}>{p}</Fragment>);
}
