// Public "Report" button — reader-facing abuse report trigger.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { submitAbuseReport } from "@/lib/abuse-reports.functions";

interface Props {
  targetKind: "post" | "comment" | "other";
  targetId: string;
  targetUrl?: string;
  managedSiteId?: string | null;
  variant?: "link" | "button";
  label?: string;
}

export function ReportButton({ targetKind, targetId, targetUrl, managedSiteId, variant = "link", label }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const fn = useServerFn(submitAbuseReport);
  const mut = useMutation({
    mutationFn: () => fn({ data: {
      target_kind: targetKind,
      target_id: targetId,
      target_url: targetUrl ?? (typeof window !== "undefined" ? window.location.href : null),
      managed_site_id: managedSiteId ?? null,
      reporter_email: email || null,
      reason,
      details,
    } }),
    onSuccess: () => setSent(true),
    onError: (e: Error) => alert(e.message),
  });

  const trigger = variant === "button" ? (
    <button onClick={() => setOpen(true)} className="rounded-md border px-3 py-1 text-xs font-semibold">
      {label ?? "Report"}
    </button>
  ) : (
    <button onClick={() => setOpen(true)} className="text-xs text-muted-foreground underline hover:text-primary">
      {label ?? "Report"}
    </button>
  );

  return (
    <>
      {trigger}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !mut.isPending && setOpen(false)}>
          <div className="w-full max-w-md rounded-lg border bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {sent ? (
              <div>
                <h2 className="font-semibold text-primary">Thanks — report submitted</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Our team will review and take action if needed.
                </p>
                <button onClick={() => { setOpen(false); setSent(false); setReason(""); setDetails(""); setEmail(""); }}
                        className="mt-4 h-10 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                  Close
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-semibold text-primary">Report content</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tell us what's wrong with this {targetKind}. Include specifics.
                </p>
                <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Reason *</label>
                    <select value={reason} onChange={(e) => setReason(e.target.value)} required
                            className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                      <option value="">Choose a reason…</option>
                      <option>Spam or misleading</option>
                      <option>Harassment or hate</option>
                      <option>Illegal or dangerous content</option>
                      <option>Copyright / DMCA</option>
                      <option>Personal information (doxxing)</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Details</label>
                    <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} maxLength={4000}
                              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                              placeholder="What's the problem? (optional)" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Your email (optional)</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                           className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                           placeholder="If we need to follow up" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setOpen(false)}
                            className="h-10 flex-1 rounded-md border text-sm font-semibold">Cancel</button>
                    <button type="submit" disabled={mut.isPending || !reason}
                            className="h-10 flex-1 rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">
                      {mut.isPending ? "Sending…" : "Submit"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
