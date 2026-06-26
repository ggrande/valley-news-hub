// Client-side stable browser fingerprint. Combines canvas hash, screen, UA,
// timezone, and language. Cached in sessionStorage to avoid recomputation.
// This is NOT a security boundary on its own — server adds IP + signed cookie.

const KEY = "wkna_verdict_fp_v1";

function canvasHash(): string {
  try {
    const c = document.createElement("canvas");
    c.width = 220;
    c.height = 30;
    const ctx = c.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#069";
    ctx.fillText("WKNA-49-Verdict-Arena", 2, 2);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("⚖️ court", 60, 16);
    return c.toDataURL().slice(-64);
  } catch {
    return "canvas-err";
  }
}

export function getBrowserFingerprint(): string {
  if (typeof window === "undefined") return "ssr";
  const cached = sessionStorage.getItem(KEY);
  if (cached) return cached;
  const parts = [
    navigator.userAgent,
    navigator.language,
    String(screen.width) + "x" + String(screen.height),
    String(screen.colorDepth),
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency ?? 0),
    canvasHash(),
  ];
  const fp = parts.join("|");
  try { sessionStorage.setItem(KEY, fp); } catch { /* ignore */ }
  return fp;
}
