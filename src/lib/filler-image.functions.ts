import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Re-exported for components that import the default prompt for UI display.
export { DEFAULT_FILLER_PROMPT } from "@/lib/filler-image.server";

// Generates a photorealistic filler image for a post using the Lovable AI gateway,
// uploads it to the news-media bucket, and sets featured_image/og_image.
export const generateFillerImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { postId: string; force?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateFillerImageForPost } = await import("@/lib/filler-image.server");
    return await generateFillerImageForPost(supabaseAdmin, data.postId, { force: data.force });
  });
