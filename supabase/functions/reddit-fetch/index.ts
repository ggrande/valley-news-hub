// Admin-only Reddit JSON fetch. Requires a valid Supabase JWT belonging to
// a user with the `admin` role; the public anon key alone is rejected.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

function jsonErr(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    // 1) Require a real Supabase user JWT (anon key alone is rejected).
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return jsonErr("Unauthorized", 401);
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return jsonErr("Unauthorized", 401);

    // 2) Require admin role (server-side, via has_role RPC).
    const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || isAdmin !== true) return jsonErr("Forbidden", 403);

    const { url } = await req.json();
    if (!url) return jsonErr("url required", 400);
    const target = normalizeUrl(url);
    if (!target) return jsonErr("Not a valid Reddit URL", 400);

    const res = await fetch(target, {
      headers: { "User-Agent": "WKNA49NewsBot/1.0 (intake)" },
    });
    if (!res.ok) return jsonErr(`Reddit returned ${res.status}. Try manual paste.`, 502);

    const data = await res.json();
    const postData = data?.[0]?.data?.children?.[0]?.data;
    if (!postData) return jsonErr("Could not parse Reddit response. Try manual paste.", 502);

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
    return jsonErr((e as Error).message, 500);
  }
});
