import { useState } from "react";
import { Facebook, Linkedin, Link2, Mail, Share2, Check } from "lucide-react";

type Props = {
  url: string;
  title: string;
  summary?: string;
  className?: string;
  label?: string;
};

// X / Twitter glyph (Lucide doesn't ship the post-rebrand mark).
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function RedditIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M22 12.07c0-1.21-.98-2.2-2.19-2.2-.59 0-1.13.23-1.52.62-1.5-1.07-3.55-1.77-5.83-1.85l1-4.7 3.27.7c.04.82.72 1.48 1.55 1.48.86 0 1.55-.7 1.55-1.55S18.13 3 17.27 3c-.61 0-1.14.35-1.4.86l-3.65-.78a.38.38 0 0 0-.45.29l-1.1 5.2c-2.3.07-4.37.77-5.88 1.85a2.19 2.19 0 0 0-1.52-.62A2.19 2.19 0 0 0 2 12.07c0 .87.5 1.61 1.22 1.97-.05.24-.07.5-.07.75 0 3.01 3.5 5.45 7.84 5.45 4.34 0 7.84-2.44 7.84-5.45 0-.25-.02-.5-.07-.74A2.2 2.2 0 0 0 22 12.07M7.27 13.62c0-.86.7-1.55 1.55-1.55s1.55.69 1.55 1.55c0 .85-.7 1.55-1.55 1.55-.85 0-1.55-.7-1.55-1.55m8.24 3.97c-1 1-2.94 1.07-3.51 1.07-.57 0-2.51-.08-3.51-1.07a.37.37 0 0 1 0-.53.37.37 0 0 1 .53 0c.64.64 2 .86 2.98.86s2.35-.22 2.98-.86a.37.37 0 0 1 .53 0c.14.14.14.39 0 .53m-.29-2.42c-.85 0-1.55-.7-1.55-1.55 0-.86.7-1.55 1.55-1.55s1.55.69 1.55 1.55c0 .85-.69 1.55-1.55 1.55" />
    </svg>
  );
}

export function ShareBar({ url, title, summary = "", className = "", label = "Share this story" }: Props) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const shareUrl = url;
  const shareText = `${title}${summary ? ` — ${summary}` : ""}`;

  const targets = [
    {
      key: "x",
      label: "Share on X",
      href: `https://twitter.com/intent/tweet?url=${enc(shareUrl)}&text=${enc(title)}`,
      Icon: XIcon,
    },
    {
      key: "facebook",
      label: "Share on Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}`,
      Icon: Facebook,
    },
    {
      key: "reddit",
      label: "Share on Reddit",
      href: `https://www.reddit.com/submit?url=${enc(shareUrl)}&title=${enc(title)}`,
      Icon: RedditIcon,
    },
    {
      key: "linkedin",
      label: "Share on LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(shareUrl)}`,
      Icon: Linkedin,
    },
    {
      key: "email",
      label: "Share by email",
      href: `mailto:?subject=${enc(title)}&body=${enc(`${summary ? summary + "\n\n" : ""}${shareUrl}`)}`,
      Icon: Mail,
    },
  ];

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — user can long-press the URL */
    }
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text: summary, url: shareUrl });
      } catch {
        /* user cancelled */
      }
    } else {
      copyLink();
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </span>
      {targets.map((t) => (
        <a
          key={t.key}
          href={t.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.label}
          title={t.label}
          className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          <t.Icon className="size-4" />
        </a>
      ))}
      <button
        type="button"
        onClick={copyLink}
        aria-label={copied ? "Link copied" : "Copy link"}
        title={copied ? "Link copied" : "Copy link"}
        className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-primary transition hover:bg-primary hover:text-primary-foreground"
      >
        {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
      </button>
      <button
        type="button"
        onClick={nativeShare}
        aria-label="More sharing options"
        title="More sharing options"
        className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-primary transition hover:bg-primary hover:text-primary-foreground sm:hidden"
      >
        <Share2 className="size-4" />
      </button>
    </div>
  );
}
