import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/authors")({
  component: AuthorsAdmin,
});

function AuthorsAdmin() {
  const q = useQuery({ queryKey: ["authors-admin"], queryFn: async () => (await supabase.from("authors").select("*").order("name")).data ?? [] });
  const [form, setForm] = useState({ name: "", title: "", bio: "", slug: "" });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from("authors").insert({ ...form, slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-") });
    setForm({ name: "", title: "", bio: "", slug: "" }); q.refetch();
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-black text-primary">Authors</h1>
      <form onSubmit={add} className="space-y-2 rounded-lg border bg-white p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="h-10 rounded border px-3 text-sm" />
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title (e.g. Reporter)" className="h-10 rounded border px-3 text-sm" />
        </div>
        <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Bio" rows={2} className="w-full rounded border px-3 py-2 text-sm" />
        <button className="h-10 rounded bg-primary px-4 text-sm font-semibold text-primary-foreground">Add author</button>
      </form>
      <div className="space-y-2">
        {q.data?.map((a: any) => (
          <div key={a.id} className="rounded-lg border bg-white p-4">
            <p className="font-display font-bold text-primary">{a.name} <span className="text-xs font-normal text-muted-foreground">— {a.title ?? ""}</span></p>
            <p className="text-sm text-muted-foreground">{a.bio}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
