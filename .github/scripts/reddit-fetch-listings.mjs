// Playwright worker that fetches a subreddit listing (hot/new/top/rising/best)
// using the WKNA49 logged-in session, then posts the raw Reddit JSON back to
// Lovable Cloud. Reddit blocks unauthenticated JSON from datacenter IPs, but
// accepts requests carrying a valid session cookie via a real browser.
//
// Flow:
//   1. POST {APP_BASE_URL}/api/public/hooks/reddit-listing-job (HMAC) →
//      { job_id, subreddit, sort, top_window, limit, session_cookies }
//   2. Load cookies into a Chromium context. Visit reddit.com first to
//      establish origin, then fetch /r/<sub>/<sort>.json?limit=N&t=<window>.
//   3. POST {APP_BASE_URL}/api/public/hooks/reddit-listing-callback with
//      { job_id, status, listing, refreshed_cookies }.

import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const SHOT_DIR = "/tmp/reddit-listing-shots";
mkdirSync(SHOT_DIR, { recursive: true });

const APP_BASE_URL = mustEnv("APP_BASE_URL").replace(/\/$/, "");
const SECRET = mustEnv("REDDIT_WORKER_WEBHOOK_SECRET");
const JOB_ID = mustEnv("JOB_ID");
const GITHUB_RUN_URL = process.env.GITHUB_RUN_URL || "";
const REDDIT_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

function mustEnv(name) {
  const v = process.env[name];
  if (!v) { console.error(`Missing env: ${name}`); process.exit(2); }
  return v;
}

function sign(timestamp, body) {
  return createHmac("sha256", SECRET).update(`${timestamp}.${body}`).digest("hex");
}

async function callApp(path, payload) {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const res = await fetch(`${APP_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-timestamp": ts,
      "x-worker-signature": sign(ts, body),
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${text.slice(0, 400)}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

function normalizeSameSite(value) {
  const v = String(value || "").toLowerCase();
  if (v === "strict") return "Strict";
  if (v === "none" || v === "no_restriction") return "None";
  if (v === "lax") return "Lax";
  return undefined;
}

function normalizeRedditCookie(cookie) {
  if (!cookie?.name || !cookie?.value) return null;
  const out = {
    name: String(cookie.name),
    value: String(cookie.value),
    path: cookie.path || "/",
    secure: cookie.secure !== false,
    httpOnly: Boolean(cookie.httpOnly),
  };
  const expires = Number(cookie.expires ?? cookie.expirationDate);
  if (Number.isFinite(expires) && expires > 0) out.expires = Math.floor(expires);
  const sameSite = normalizeSameSite(cookie.sameSite);
  if (sameSite) out.sameSite = sameSite;
  if (out.sameSite === "None") out.secure = true;

  const rawDomain = String(cookie.domain || "").replace(/^\./, "").toLowerCase();
  if (out.name.startsWith("__Host-")) {
    out.url = "https://www.reddit.com";
  } else if (rawDomain.endsWith("reddit.com")) {
    out.domain = ".reddit.com";
  } else if (cookie.url) {
    out.url = cookie.url;
  } else {
    out.domain = ".reddit.com";
  }
  return out;
}

async function restoreCookies(context, cookies) {
  let restored = 0;
  for (const raw of Array.isArray(cookies) ? cookies : []) {
    const c = normalizeRedditCookie(raw);
    if (!c) continue;
    try { await context.addCookies([c]); restored++; } catch (e) { console.warn("[cookies]", c.name, e?.message); }
  }
  console.log(`[cookies] restored ${restored}`);
  return restored;
}

async function shot(page, name) {
  try { await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: false }); } catch {}
}

async function fetchListing(context, page, { subreddit, sort, top_window, limit }) {
  // Warm the origin so cookies are sent on subsequent requests.
  await page.goto("https://www.reddit.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(500);

  const params = new URLSearchParams({ limit: String(Math.min(100, limit || 25)), raw_json: "1" });
  if (sort === "top") params.set("t", top_window || "day");
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/${sort || "new"}.json?${params}`;

  const res = await context.request.get(url, {
    headers: { "User-Agent": REDDIT_UA, Accept: "application/json", "Accept-Language": "en-US,en;q=0.9" },
  });
  const status = res.status();
  console.log(`[listing] GET ${url} → ${status}`);
  if (status !== 200) {
    await shot(page, "listing-error");
    const body = await res.text().catch(() => "");
    throw new Error(`Reddit responded ${status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const children = json?.data?.children ?? [];
  return children.map((c) => c?.data).filter(Boolean);
}

async function main() {
  let job;
  try {
    job = await callApp("/api/public/hooks/reddit-listing-job", { job_id: JOB_ID });
  } catch (err) { console.error("Fetch job failed:", err); process.exit(3); }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: REDDIT_UA, viewport: { width: 1280, height: 900 } });

  await restoreCookies(context, job.session_cookies || []);
  const page = await context.newPage();

  let payload = { job_id: JOB_ID, github_run_url: GITHUB_RUN_URL, status: "failed", error: "unknown" };
  try {
    const posts = await fetchListing(context, page, job);
    const refreshed = await context.cookies();
    payload = {
      job_id: JOB_ID,
      github_run_url: GITHUB_RUN_URL,
      status: "succeeded",
      posts,
      refreshed_cookies: refreshed,
      session_status: "active",
    };
    console.log(`[listing] fetched ${posts.length} posts from r/${job.subreddit}/${job.sort}`);
  } catch (err) {
    const msg = (err?.message || String(err)).slice(0, 800);
    console.error("Worker error:", msg);
    payload = {
      job_id: JOB_ID,
      github_run_url: GITHUB_RUN_URL,
      status: "failed",
      error: msg,
      session_status: /401|403|forbidden|unauthorized|login/i.test(msg) ? "expired" : "error",
    };
    try { writeFileSync(`${SHOT_DIR}/error.txt`, msg); } catch {}
  } finally {
    await browser.close().catch(() => {});
    try { await callApp("/api/public/hooks/reddit-listing-callback", payload); }
    catch (e) { console.error("Callback failed:", e); }
  }

  if (payload.status !== "succeeded") process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  callApp("/api/public/hooks/reddit-listing-callback", {
    job_id: JOB_ID, status: "failed", error: String(err?.message || err), github_run_url: GITHUB_RUN_URL,
  }).finally(() => process.exit(1));
});
