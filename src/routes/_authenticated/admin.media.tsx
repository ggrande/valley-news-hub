import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/media")({
  component: Media,
});

function Media() {
  const q = useQuery({ queryKey: ["media"], queryFn: async () => (await supabase.from("media_assets").select("*").order("created_at", { ascending: false })).data ?? [] });
  const [form, setForm] = useState({ url: "", alt_text: "", credit: "" });
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from("media_assets").insert(form);
    setForm({ url: "", alt_text: "", credit: "" }); q.refetch();
  };
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-black text-primary">Media Library</h1>
      <p className="text-sm text-muted-foreground">Track image URLs used in posts.</p>
      <form onSubmit={add} className="space-y-2 rounded-lg border bg-white p-4">
        <input required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="Image URL" className="h-10 w-full rounded border px-3 text-sm" />
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={form.alt_text} onChange={(e) => setForm({ ...form, alt_text: e.target.value })} placeholder="Alt text" className="h-10 rounded border px-3 text-sm" />
          <input value={form.credit} onChange={(e) => setForm({ ...form, credit: e.target.value })} placeholder="Credit" className="h-10 rounded border px-3 text-sm" />
        </div>
        <button className="h-10 rounded bg-primary px-4 text-sm font-semibold text-primary-foreground">Add to library</button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {q.data?.map((m: any) => (
          <div key={m.id} className="overflow-hidden rounded-lg border bg-white">
            <img src={m.url} alt={m.alt_text ?? ""} className="aspect-video w-full object-cover" />
            <div className="p-3 text-xs"><p className="truncate text-muted-foreground">{m.url}</p><p>{m.alt_text}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}
