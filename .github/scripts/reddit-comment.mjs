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

async function loginFresh(context, page, username, password) {
  await page.goto("https://www.reddit.com/login/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  // The new Reddit login form lives in a shadow DOM (faceplate-tabpanel).
  // Use input[name=username] / input[name=password] which work in both old and new UIs.
  const userInput = page.locator('input[name="username"]').first();
  const passInput = page.locator('input[name="password"]').first();
  await userInput.waitFor({ timeout: 15000 });
  await userInput.fill(username);
  await passInput.fill(password);
  await shot(page, "01-login-filled");
  await page.keyboard.press("Enter");
  // Wait for nav OR challenge
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await shot(page, "02-after-login");

  // Detect a few failure modes
  const url = page.url();
  if (/login/i.test(url) && !/\/r\//.test(url)) {
    const bodyText = (await page.locator("body").innerText().catch(() => "")) || "";
    if (/incorrect|invalid/i.test(bodyText)) {
      throw Object.assign(new Error("Reddit rejected credentials"), { kind: "login_required" });
    }
    if (/verify|captcha|challenge|two-step|code/i.test(bodyText)) {
      throw Object.assign(new Error("Reddit requires a manual verification step"), { kind: "challenge_required" });
    }
    throw Object.assign(new Error(`Still on login page: ${url}`), { kind: "login_required" });
  }
  return await context.cookies();
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
    // Verify we're logged in by hitting the account page. If not, log in fresh.
    await page.goto("https://www.reddit.com/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const loggedInIndicator = await page.locator(`[href*="/user/${job.reddit_username}"], [aria-label*="${job.reddit_username}"]`).first().count().catch(() => 0);

    if (!loggedInIndicator) {
      if (!job.reddit_username || !job.reddit_password) {
        throw Object.assign(new Error("Session expired and no credentials configured"), { kind: "login_required" });
      }
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
