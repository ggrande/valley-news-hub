// Public Reddit JSON fetch. No auth required (admin gate is enforced in the app).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeUrl(input: string): string | null {
  try {
    const u = new URL(input.trim());
    if (!/reddit\.com$/.test(u.hostname) && !u.hostname.endsWith(".reddit.com")) return null;
    let p = u.pathname.replace(/\/+$/, "");
    if (!p.endsWith(".json")) p += ".json";
    return `https://www.reddit.com${p}?raw_json=1&limit=200`;
  } catch {
    return null;
  }
}

interface Comment {
  id: string;
  parent_id: string | null;
  author: string;
  body: string;
  score: number;
  created_utc: number | null;
  depth: number;
}

function flatten(node: any, parent: string | null, depth: number, out: Comment[]) {
  if (!node || node.kind !== "t1") return;
  const d = node.data;
  if (!d || !d.body) return;
  out.push({
    id: d.id,
    parent_id: parent,
    author: d.author ?? "[deleted]",
    body: d.body,
    score: d.score ?? 0,
    created_utc: d.created_utc ?? null,
    depth,
  });
  const replies = d.replies;
  if (replies && replies.data && Array.isArray(replies.data.children)) {
    for (const child of replies.data.children) flatten(child, d.id, depth + 1, out);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: "url required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    const target = normalizeUrl(url);
    if (!target) return new Response(JSON.stringify({ error: "Not a valid Reddit URL" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const res = await fetch(target, {
      headers: { "User-Agent": "WKNA49NewsBot/1.0 (intake)" },
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Reddit returned ${res.status}. Try manual paste.` }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const data = await res.json();
    const postData = data?.[0]?.data?.children?.[0]?.data;
    if (!postData) {
      return new Response(JSON.stringify({ error: "Could not parse Reddit response. Try manual paste." }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const comments: Comment[] = [];
    const children = data?.[1]?.data?.children ?? [];
    for (const c of children) flatten(c, null, 0, comments);

    return new Response(
      JSON.stringify({
        post: {
          reddit_post_id: postData.id,
          subreddit: postData.subreddit,
          title: postData.title,
          body: postData.selftext ?? "",
          author: postData.author,
          permalink: `https://www.reddit.com${postData.permalink}`,
          score: postData.score,
          created_utc: postData.created_utc,
        },
        comments,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
