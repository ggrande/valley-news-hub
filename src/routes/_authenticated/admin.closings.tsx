import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/closings")({
  component: ClosingsAdmin,
});

type ClosingRow = {
  id: string;
  name: string;
  type: "school" | "government" | "business" | "other";
  status: "closed" | "delayed" | "early_dismissal" | "virtual" | "normal";
  county: string | null;
  note: string | null;
  effective_date: string;
  expires_at: string | null;
};

const blank = {
  name: "",
  type: "school" as ClosingRow["type"],
  status: "closed" as ClosingRow["status"],
  county: "Kanawha",
  note: "",
};

function ClosingsAdmin() {
  const q = useQuery({
    queryKey: ["closings-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("closings" as never)
        .select("*")
        .order("effective_date", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as ClosingRow[];
    },
  });
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("closings" as never).insert({
      name: form.name,
      type: form.type,
      status: form.status,
      county: form.county || null,
      note: form.note || null,
    } as never);
    setSaving(false);
    if (error) return alert(error.message);
    setForm(blank);
    q.refetch();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this closing?")) return;
    await supabase.from("closings" as never).delete().eq("id", id);
    q.refetch();
  };

  const setStatus = async (id: string, status: ClosingRow["status"]) => {
    await supabase.from("closings" as never).update({ status } as never).eq("id", id);
    q.refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-black text-primary">Closings & Delays</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the live tracker at <code>/weather/closings</code>. Entries appear immediately for the public.
        </p>
      </div>

      <form onSubmit={add} className="grid gap-2 rounded-lg border bg-white p-4 sm:grid-cols-2">
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name (e.g. Kanawha County Schools)" className="h-10 rounded border px-3 text-sm sm:col-span-2" />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ClosingRow["type"] })} className="h-10 rounded border px-3 text-sm">
          <option value="school">School</option>
          <option value="government">Government</option>
          <option value="business">Business</option>
          <option value="other">Other</option>
        </select>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ClosingRow["status"] })} className="h-10 rounded border px-3 text-sm">
          <option value="closed">Closed</option>
          <option value="delayed">Delayed (2-hour)</option>
          <option value="early_dismissal">Early Dismissal</option>
          <option value="virtual">Virtual</option>
          <option value="normal">Normal / Cleared</option>
        </select>
        <input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} placeholder="County" className="h-10 rounded border px-3 text-sm" />
        <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note (optional)" className="h-10 rounded border px-3 text-sm" />
        <button disabled={saving} className="h-10 rounded bg-primary px-4 text-sm font-semibold text-primary-foreground sm:col-span-2">
          {saving ? "Saving…" : "Add closing"}
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--ivory)] text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">County</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Note</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 font-semibold text-primary">{r.name}</td>
                <td className="px-4 py-2 capitalize text-muted-foreground">{r.type}</td>
                <td className="px-4 py-2 text-muted-foreground">{r.county ?? "—"}</td>
                <td className="px-4 py-2">
                  <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value as ClosingRow["status"])} className="h-8 rounded border px-2 text-xs">
                    <option value="closed">Closed</option>
                    <option value="delayed">Delayed</option>
                    <option value="early_dismissal">Early Dismissal</option>
                    <option value="virtual">Virtual</option>
                    <option value="normal">Normal</option>
                  </select>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{r.note ?? ""}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => remove(r.id)} className="text-xs font-semibold text-[color:var(--breaking)] hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {(q.data ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No closings yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
