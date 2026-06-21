import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: Settings,
});

const KEYS = [
  { key: "allow_public_comments", label: "Allow public comment submission", type: "bool", default: false },
  { key: "show_imported_discussion", label: "Show imported discussion comments on articles", type: "bool", default: true },
  { key: "ai_max_comments", label: "Max comments used in AI generation", type: "number", default: 100 },
  { key: "ai_target_length", label: "Default AI article length", type: "text", default: "500-800 words" },
];

function Settings() {
  const q = useQuery({ queryKey: ["settings"], queryFn: async () => (await supabase.from("site_settings").select("*")).data ?? [] });
  const [vals, setVals] = useState<Record<string, any>>({});

  useEffect(() => {
    if (q.data) {
      const map: Record<string, any> = {};
      for (const r of q.data) map[(r as any).key] = (r as any).value;
      setVals(map);
    }
  }, [q.data]);

  const save = async (key: string, value: any) => {
    setVals((v) => ({ ...v, [key]: value }));
    await supabase.from("site_settings").upsert({ key, value });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-black text-primary">Site Settings</h1>
      <div className="space-y-4 rounded-lg border bg-white p-6">
        {KEYS.map((k) => {
          const v = vals[k.key] ?? k.default;
          if (k.type === "bool") return (
            <label key={k.key} className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{k.label}</span>
              <input type="checkbox" checked={!!v} onChange={(e) => save(k.key, e.target.checked)} />
            </label>
          );
          if (k.type === "number") return (
            <label key={k.key} className="block">
              <span className="text-sm font-semibold">{k.label}</span>
              <input type="number" value={v ?? ""} onChange={(e) => save(k.key, Number(e.target.value))} className="mt-1 h-10 w-full rounded border px-3 text-sm" />
            </label>
          );
          return (
            <label key={k.key} className="block">
              <span className="text-sm font-semibold">{k.label}</span>
              <input value={v ?? ""} onChange={(e) => save(k.key, e.target.value)} className="mt-1 h-10 w-full rounded border px-3 text-sm" />
            </label>
          );
        })}
      </div>
    </div>
  );
}
