// Playwright worker that posts a single Reddit comment as u/WKNA49.
// Invoked by .github/workflows/reddit-comment.yml.
//
// Flow:
//   1. POST {APP_BASE_URL}/api/public/hooks/reddit-comment-job
//      (HMAC signed) → receives { action, notification, reddit_username, reddit_password, session_cookies }
//   2. Restore cookies into a fresh browser context; if missing or invalid, log in fresh.
//   3. action=post-comment: navigate to thread, paste rendered_comment, submit.
//      action=capture-session: nothing more than the login itself.
//   4. POST {APP_BASE_URL}/api/public/hooks/reddit-comment-callback with the
//      result + refreshed cookies.
//
// Failures are categorized so the orchestrator can decide what to do:
//   succeeded | failed | login_required | challenge_required | thread_locked | duplicate

import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const SHOT_DIR = "/tmp/reddit-shots";
mkdirSync(SHOT_DIR, { recursive: true });

const APP_BASE_URL = mustEnv("APP_BASE_URL").replace(/\/$/, "");
const SECRET = mustEnv("REDDIT_WORKER_WEBHOOK_SECRET");
const NOTIFICATION_ID = mustEnv("NOTIFICATION_ID");
const EVENT_TYPE = process.env.EVENT_TYPE || "reddit-comment";
const GITHUB_RUN_ID = process.env.GITHUB_RUN_ID || "";
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
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function report(result) {
  try {
    await callApp("/api/public/hooks/reddit-comment-callback", {
      notification_id: NOTIFICATION_ID,
      action: EVENT_TYPE === "reddit-capture-session" ? "capture-session" : "post-comment",
      github_run_id: GITHUB_RUN_ID,
      github_run_url: GITHUB_RUN_URL,
      ...result,
    });
  } catch (err) {
    console.error("Callback failed:", err);
  }
}

async function shot(page, name) {
  try { await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: false }); } catch {}
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
    const cookie = normalizeRedditCookie(raw);
    if (!cookie) continue;
    try {
      await context.addCookies([cookie]);
      restored += 1;
    } catch (e) {
      console.warn(`[cookies] skipped ${cookie.name}:`, e?.message);
    }
  }
  console.log(`[cookies] restored ${restored} Reddit cookies`);
  return restored;
}

async function getLoggedInUser(context) {
  for (const url of ["https://www.reddit.com/api/me.json", "https://old.reddit.com/api/me.json"]) {
    try {
      const res = await context.request.get(url, { headers: { "User-Agent": REDDIT_UA, Accept: "application/json" } });
      const json = await res.json().catch(() => ({}));
      const name = json?.data?.name || json?.name || null;
      if (name) return name;
    } catch (e) {
      console.warn(`[session-check] ${url} failed:`, e?.message);
    }
  }
  return null;
}

async function waitForLoginForm(page) {
  const userInput = page.locator('input[name="username"], input[name="user"]').first();
  const passInput = page.locator('input[name="password"], input[name="passwd"], input[type="password"]').first();
  for (let i = 0; i < 30; i += 1) {
    if (await userInput.isVisible().catch(() => false)) return { userInput, passInput };
    const bodyText = (await page.locator("body").innerText({ timeout: 1000 }).catch(() => "")) || "";
    if (/blocked|captcha|robot|challenge|verify|two[-\s]?factor|too many requests/i.test(bodyText)) {
      throw Object.assign(new Error(`Reddit did not show a login form; manual verification appears required at ${page.url()}`), { kind: "challenge_required" });
    }
    await page.waitForTimeout(1000);
  }
  await shot(page, "01-login-form-missing");
  throw Object.assign(new Error(`Reddit login form did not load at ${page.url()}; use pasted cookies instead of headless login`), { kind: "challenge_required" });
}

async function loginFresh(context, page, username, password) {
  await page.goto("https://www.reddit.com/login/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await shot(page, "01-login-page");

  const { userInput, passInput } = await waitForLoginForm(page);
  await userInput.fill(username);
  await passInput.fill(password);
  await shot(page, "01b-login-filled");
  const submitBtn = page.locator('button[type="submit"], faceplate-button[type="submit"]').first();
  await submitBtn.click({ timeout: 5000 }).catch(async () => { await passInput.press("Enter"); });

  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await shot(page, "02-after-login");

  const errText = (await page.locator('.status, .error, faceplate-form-helper-text, [role="alert"]').first().innerText().catch(() => "")) || "";
  if (/incorrect|wrong password|invalid/i.test(errText)) {
    throw Object.assign(new Error(`Reddit rejected credentials: ${errText}`), { kind: "login_required" });
  }
  if (/verify|captcha|challenge|two-step|otp|code/i.test(errText)) {
    throw Object.assign(new Error(`Reddit requires a manual verification step: ${errText}`), { kind: "challenge_required" });
  }

  const name = await getLoggedInUser(context);
  if (!name) {
    throw Object.assign(new Error("Login submitted but session is not active (likely captcha / 2FA challenge)"), { kind: "challenge_required" });
  }
  console.log("[loginFresh] logged in as", name);
  return { name, cookies: await context.cookies() };
}

async function postComment(page, threadUrl, text) {
  // Use old.reddit.com — the markup is stable and the comment form is plain HTML.
  const oldUrl = threadUrl
    .replace(/^https?:\/\/(www\.|new\.)?reddit\.com/, "https://old.reddit.com");
  await page.goto(oldUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1000);
  await shot(page, "03-thread");

  // Detect locked / archived threads
  const bodyText = (await page.locator("body").innerText().catch(() => "")) || "";
  if (/this thread is archived|locked\.\s*new comments cannot/i.test(bodyText)) {
    throw Object.assign(new Error("Thread is locked or archived"), { kind: "thread_locked" });
  }

  // The top-level comment box on old.reddit is a textarea inside .commentarea > .usertext-edit
  const ta = page.locator(".commentarea > form textarea, .commentarea .usertext-edit textarea").first();
  await ta.waitFor({ timeout: 15000 });
  await ta.click();
  await ta.fill(text);
  await shot(page, "04-comment-filled");

  // Submit
  const submitBtn = page.locator('.commentarea form button[type="submit"], .commentarea form .save').first();
  await submitBtn.click();
  await page.waitForTimeout(3500);
  await shot(page, "05-after-submit");

  // Try to find the just-posted comment permalink: look for the most recent comment
  // by our user near the top of the comment area.
  const permalinkEl = page.locator(`.commentarea .comment a.bylink`).first();
  let permalink = null;
  try {
    permalink = await permalinkEl.getAttribute("href", { timeout: 5000 });
    if (permalink && permalink.startsWith("/")) permalink = `https://old.reddit.com${permalink}`;
  } catch {}

  // Detect rate-limit / duplicate errors near the form
  const errText = (await page.locator(".commentarea form .error, .commentarea .error").first().innerText().catch(() => "")) || "";
  if (/you are doing that too much|try again in/i.test(errText)) {
    throw Object.assign(new Error(`Rate-limited: ${errText}`), { kind: "failed" });
  }
  if (/that comment was already submitted|duplicate/i.test(errText)) {
    return { duplicate: true, permalink };
  }
  if (errText) {
    throw Object.assign(new Error(`Submit error: ${errText}`), { kind: "failed" });
  }

  return { permalink };
}

async function main() {
  let job;
  try {
    job = await callApp("/api/public/hooks/reddit-comment-job", { notification_id: NOTIFICATION_ID });
  } catch (err) {
    console.error("Failed to fetch job:", err);
    process.exit(3);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });

  // Restore cookies if we have any
  if (Array.isArray(job.session_cookies) && job.session_cookies.length) {
    try { await context.addCookies(job.session_cookies); } catch (e) { console.warn("addCookies failed:", e?.message); }
  }

  const page = await context.newPage();
  let result = { status: "failed", log_excerpt: "unknown" };

  try {
    // Verify we're logged in via Reddit's JSON API — works reliably for both
    // old and new Reddit, no DOM scraping required. If pasted cookies are valid,
    // /api/me.json returns the user object; otherwise it returns an empty {}.
    let loggedInAs = null;
    try {
      const meResp = await context.request.get("https://www.reddit.com/api/me.json", {
        headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36" },
      });
      const meJson = await meResp.json().catch(() => ({}));
      loggedInAs = meJson?.data?.name || meJson?.name || null;
      console.log("[session-check] /api/me.json →", loggedInAs ? `logged in as ${loggedInAs}` : "anonymous");
    } catch (e) {
      console.warn("[session-check] me.json failed:", e?.message);
    }

    if (!loggedInAs) {
      if (!job.reddit_username || !job.reddit_password) {
        throw Object.assign(new Error("Session expired or invalid. Paste fresh cookies in the admin panel."), { kind: "login_required" });
      }
      await page.goto("https://www.reddit.com/", { waitUntil: "domcontentloaded" });
      await loginFresh(context, page, job.reddit_username, job.reddit_password);
    }

    const refreshedCookies = await context.cookies();

    if (job.action === "capture-session") {
      result = { status: "succeeded", session_status: "active", refreshed_cookies: refreshedCookies, log_excerpt: "Session captured" };
    } else {
      const notif = job.notification;
      if (!notif) throw new Error("Job missing notification payload");
      const { duplicate, permalink } = await postComment(page, notif.thread_url, notif.rendered_comment);
      result = {
        status: duplicate ? "duplicate" : "succeeded",
        reddit_comment_permalink: permalink,
        session_status: "active",
        refreshed_cookies: refreshedCookies,
        log_excerpt: duplicate ? "Comment already submitted" : "Posted",
      };
    }
  } catch (err) {
    const kind = err?.kind || "failed";
    const msg = (err?.message || String(err)).slice(0, 800);
    console.error("Worker error:", msg);
    result = {
      status: kind,
      session_status: kind === "login_required" ? "expired" : kind === "challenge_required" ? "challenge_required" : "error",
      log_excerpt: msg,
    };
    try { writeFileSync(`${SHOT_DIR}/error.txt`, msg); } catch {}
  } finally {
    await browser.close().catch(() => {});
    await report(result);
  }

  if (result.status !== "succeeded" && result.status !== "duplicate") process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  report({ status: "failed", log_excerpt: String(err?.message || err) }).finally(() => process.exit(1));
});
