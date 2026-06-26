## Goal

Stop fighting the Lovable rewriter. Generate each AMP Web Story as a real `.html` file, host it in a public storage bucket, and point Google (sitemap + `<link rel="amphtml">`) directly at the storage URL. The app route disappears from the request path, so script injection cannot reach it.

## Steps

1. **Flip `web-stories` bucket to public.** If the workspace blocks public buckets, stop and surface the error so you can enable it in workspace Settings → Privacy & Security.

2. **Rewrite `/api/public/web-stories/$slug`** to:
   - Build the same clean AMP HTML (no `<?xml ?>`, no `xmlns`, `<!doctype html>` + `<html amp lang="en">`).
   - Upload to `web-stories/{slug}/index.html` with `contentType: "text/html; charset=utf-8"`, `upsert: true`, `cacheControl: "300"`.
   - 302-redirect to the public URL (`{SUPABASE_URL}/storage/v1/object/public/web-stories/{slug}/index.html`).
   - Keep an inline-render fallback only if upload fails.

3. **Update sitemap** (`src/routes/sitemap[.]xml.ts`) so each story `<url>` points to the public storage URL, not the app route. Google will index the storage origin directly.

4. **Update `<link rel="amphtml">`** on `src/routes/news.$slug.tsx` to point at the public storage URL for that slug.

5. **Verify after deploy** with `curl -sD - -o /dev/null <public-url>`:
   - `Content-Type: text/html; charset=utf-8` ✅
   - No `Content-Disposition: attachment` ✅
   - Body does not contain `/~flock.js`, `/__l5e/events.js`, `<div id="root"`, or `webkit-xml-viewer-source-xml` ✅
   - Re-run Google Rich Results + AMP Test against the public URL.

## Tradeoffs / risks

- **Public bucket policy.** If the workspace forbids public buckets we'll need you to flip it on, or we fall back to long-lived signed URLs (still works, URLs just expire eventually).
- **Storage CDN MIME behavior.** Supabase storage usually honors `contentType` faithfully, but if it serves `text/plain` or forces `attachment` we'd have to move to an external host (Cloudflare R2/Pages). Step 5 catches this immediately.
- **Stale stories on edit.** Currently the route regenerates and upserts on every request, so edits to an article propagate the next time anything hits the route. If we move to "static URL only" we should keep a regenerate trigger (e.g. on article publish/update).

## Out of scope

- Backfilling all existing stories proactively. They'll regenerate on first hit; if you want a one-time backfill loop, say so and I'll add it.
- Moving to Cloudflare R2 / external host. Only if the storage test in Step 5 fails.
