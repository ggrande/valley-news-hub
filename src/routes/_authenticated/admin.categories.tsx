import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  component: CategoriesAdmin,
});

function CategoriesAdmin() {
  const q = useQuery({ queryKey: ["cats-admin"], queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [] });
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from("categories").insert({ name, slug: slug || name.toLowerCase().replace(/\s+/g, "-") });
    setName(""); setSlug(""); q.refetch();
  };
  const remove = async (id: string) => { if (confirm("Delete?")) { await supabase.from("categories").delete().eq("id", id); q.refetch(); } };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-black text-primary">Categories</h1>
      <form onSubmit={add} className="flex gap-2 rounded-lg border bg-white p-4">
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="h-10 flex-1 rounded border px-3 text-sm" />
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug" className="h-10 w-40 rounded border px-3 text-sm" />
        <button className="h-10 rounded bg-primary px-4 text-sm font-semibold text-primary-foreground">Add</button>
      </form>
      <div className="rounded-lg border bg-white">
        {q.data?.map((c: any) => (
          <div key={c.id} className="flex items-center justify-between border-b p-3 last:border-0">
            <div><p className="font-semibold text-primary">{c.name}</p><p className="text-xs text-muted-foreground">/{c.slug}</p></div>
            <button onClick={() => remove(c.id)} className="text-xs text-red-700 hover:underline">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
