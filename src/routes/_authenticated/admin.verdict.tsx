import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminListBattles, adminRestorePost } from "@/lib/verdict.functions";

export const Route = createFileRoute("/_authenticated/admin/verdict")({
  component: VerdictAdmin,
});

function VerdictAdmin() {
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["admin-verdict-battles"],
    queryFn: async () => {
      const r: any = await (adminListBattles as any)({});
      return r.battles ?? [];
    },
  });

  const restore = async (postId: string) => {
    setBusy(postId);
    try {
      await (adminRestorePost as any)({ data: { postId } });
      await q.refetch();
    } finally { setBusy(null); }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="font-display text-3xl font-black text-primary">Verdict Arena</h1>
      <p className="text-sm text-muted-foreground">
        Live battles, decided outcomes, and restore controls.
        Toggle the whole feature on/off in Site Settings (<code>verdict_arena_enabled</code>).
      </p>
      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="p-2 text-left">Post</th>
              <th className="p-2">Status</th>
              <th className="p-2">Ghosts</th>
              <th className="p-2">Keep</th>
              <th className="p-2">Remove</th>
              <th className="p-2">Voters</th>
              <th className="p-2">Opened</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((b: any) => (
              <tr key={b.id} className="border-t">
                <td className="p-2 font-mono text-xs">{b.post_id.slice(0, 8)}…</td>
                <td className="p-2 text-center">
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${b.status === "live" ? "bg-green-100 text-green-800" : b.status === "decided" ? (b.winner === "remove" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800") : "bg-gray-100"}`}>
                    {b.status === "decided" ? `${b.winner} won` : b.status}
                  </span>
                </td>
                <td className="p-2 text-center text-xs">{b.ghost_mode}</td>
                <td className="p-2 text-center font-mono">{b.keep_credits}</td>
                <td className="p-2 text-center font-mono">{b.remove_credits}</td>
                <td className="p-2 text-center font-mono">{b.participant_count}</td>
                <td className="p-2 text-center text-xs">{new Date(b.opened_at).toLocaleString()}</td>
                <td className="p-2 text-right">
                  {b.winner === "remove" && (
                    <button
                      onClick={() => restore(b.post_id)}
                      disabled={busy === b.post_id}
                      className="rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {busy === b.post_id ? "…" : "Restore post"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {(q.data ?? []).length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No battles yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
