import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/ai-log")({
  component: AiLog,
});

function AiLog() {
  const q = useQuery({ queryKey: ["ai-log"], queryFn: async () => (await supabase.from("ai_generation_logs").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-black text-primary">AI Generation Log</h1>
      <div className="space-y-3">
        {q.data?.map((r: any) => (
          <details key={r.id} className="rounded-lg border bg-white p-4">
            <summary className="cursor-pointer text-sm">
              <span className="font-semibold text-primary">{r.variation}</span> • {r.model} • {new Date(r.created_at).toLocaleString()}
            </summary>
            <div className="mt-3 space-y-3 text-xs">
              <details><summary className="cursor-pointer font-semibold">Prompt</summary><pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-50 p-3 whitespace-pre-wrap">{r.prompt}</pre></details>
              <details open><summary className="cursor-pointer font-semibold">Result</summary><pre className="mt-2 max-h-96 overflow-auto rounded bg-slate-50 p-3 whitespace-pre-wrap">{JSON.stringify(r.result, null, 2)}</pre></details>
            </div>
          </details>
        ))}
        {q.data?.length === 0 && <p className="text-muted-foreground">No AI generations yet.</p>}
      </div>
    </div>
  );
}
