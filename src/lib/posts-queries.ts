import { supabase } from "@/integrations/supabase/client";
import type { Article } from "@/lib/news-data";

export type DbPost = {
  id: string;
  slug: string;
  title: string;
  dek: string | null;
  body: string | null;
  status: string;
  published_at: string | null;
  updated_at: string | null;
  is_breaking: boolean;
  is_weather_alert: boolean;
  is_pinned: boolean;
  featured_image: string | null;
  hero_caption: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image: string | null;
  category: { slug: string; name: string } | null;
  author: { slug: string; name: string } | null;
};

const POST_SELECT =
  "id, slug, title, dek, body, status, published_at, updated_at, is_breaking, is_weather_alert, is_pinned, featured_image, hero_caption, seo_title, seo_description, og_image, category:categories(slug, name), author:authors(slug, name)";

function hueFor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function dbPostToArticle(p: DbPost): Article {
  return {
    slug: p.slug,
    title: p.title,
    category: p.category?.name ?? "News",
    author: p.author?.name ?? "WKNA 49 Newsroom",
    date: (p.published_at ?? new Date().toISOString()).slice(0, 10),
    summary: p.dek ?? "",
    body: (p.body ?? "").split(/\n\n+/).filter(Boolean),
    imageHue: hueFor(p.slug),
    image: p.featured_image ?? null,
  };
}

export async function fetchPublishedPosts(opts?: { limit?: number; categorySlug?: string }) {
  let q = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("status", "published")
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false });
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  let posts = (data ?? []) as unknown as DbPost[];
  if (opts?.categorySlug) posts = posts.filter((p) => p.category?.slug === opts.categorySlug);
  return posts;
}

export async function fetchPostBySlug(slug: string) {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return data as unknown as DbPost | null;
}

export async function fetchCommentsForPost(postId: string) {
  const { data, error } = await supabase
    .from("comments")
    .select("id, display_name, body, score, source_created_at, nesting_level, is_featured, parent_comment_id, source_type")
    .eq("post_id", postId)
    .eq("is_hidden", false)
    .eq("moderation_status", "approved")
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("source_created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSetting<T = unknown>(key: string, fallback: T): Promise<T> {
  const { data } = await supabase.from("site_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? fallback;
}
