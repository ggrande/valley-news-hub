import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  getMyManagedSiteProfile,
  updateMyManagedSiteProfile,
  type ManagedSiteDirectoryProfile,
} from "@/lib/affiliate-directory.functions";
import {
  initiateSupabaseConnect,
  getProvisioningStatus,
  listConnectedOrganizations,
  provisionTenantProject,
  finalizeTenantProvisioning,
  listProvisionAttempts,
  resetProvisioningForRetry,
  type ProvisionAttempt,
} from "@/lib/supabase-provisioning.functions";

export const Route = createFileRoute("/_authenticated/account/managed-sites/$siteId/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome — Set up your Affiliate Station" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

// ---------- Onboarding "question" steps (left side) ----------
type Step = 0 | 1 | 2 | 3 | 4;

const STEPS: { key: Step; label: string; blurb: string }[] = [
  { key: 0, label: "Project", blurb: "Choose your Supabase org & region" },
  { key: 1, label: "Identity", blurb: "Name your affiliate station" },
  { key: 2, label: "Branding", blurb: "Logo & tagline for the directory" },
  { key: 3, label: "Domain", blurb: "Connect a custom domain (optional)" },
  { key: 4, label: "Review", blurb: "Review and finish" },
];

// ---------- Maxis-style flavor messages (right side) ----------
const FLAVOR_MESSAGES = [
  "Loading journalistic integrity…",
  "Aligning spin generators…",
  "Acoustically tuning echo chamber…",
  "Polishing press credentials…",
  "Provisioning anonymous sources…",
  "Negotiating with the printing press…",
  "Calibrating Pulitzer probability matrix…",
  "Drafting strongly-worded corrections…",
  "Convening editorial board…",
  "Sharpening red pens…",
  "Brewing newsroom coffee (extra strong)…",
  "Spinning up satellite uplinks…",
  "Filing FOIA requests with the universe…",
  "Securing the front page…",
  "Stretching column inches…",
  "Translating press releases into English…",
  "Counting words, then counting them again…",
  "Asking the tough questions…",
  "Setting copy desk to 'merciless'…",
  "Warming up the breaking-news klaxon…",
  "Bribing the weather…",
  "Issuing temporary press passes…",
  "Reticulating splines, just in case…",
];

// ---------- Helpers ----------
function shortSessionCode(siteId: string): string {
  // Deterministic 8-char code from siteId (refresh-stable).
  let h = 0;
  for (let i = 0; i < siteId.length; i++) h = ((h << 5) - h + siteId.charCodeAt(i)) | 0;
  const hex = (h >>> 0).toString(36).toUpperCase().padStart(7, "0");
  return `WKNA-${hex.slice(0, 4)}-${siteId.slice(0, 4).toUpperCase()}`;
}

const STATE_PCT: Record<string, number> = {
  awaiting_oauth: 5,
  linking: 20,
  provisioning: 55,
  migrating: 85,
  ready: 100,
  failed: 100,
};

function OnboardingPage() {
  const { siteId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyManagedSiteProfile);
  const saveProfile = useServerFn(updateMyManagedSiteProfile);

  // If this page was opened in a popup as the OAuth callback target,
  // notify the opener and close — the parent window owns the wizard.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("supabase") === "connected";
    const err = params.get("supabase_error");
    if ((connected || err) && window.opener && window.opener !== window) {
      try {
        window.opener.postMessage(
          { type: "supabase-oauth", ok: connected, error: err ?? null },
          window.location.origin,
        );
      } catch {
        /* noop */
      }
      window.close();
    }
  }, []);

  const fetchStatus = useServerFn(getProvisioningStatus);
  const status = useQuery({
    queryKey: ["provisioning-status", siteId],
    queryFn: () => fetchStatus({ data: { siteId } }),
    refetchInterval: (q) => {
      const s = q.state.data?.state;
      return s === "provisioning" || s === "migrating" || s === "linking" ? 4000 : false;
    },
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ["managed-site-profile", siteId],
    queryFn: () => fetchProfile({ data: { siteId } }),
  });

  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<Partial<ManagedSiteDirectoryProfile>>({});
  const [answersComplete, setAnswersComplete] = useState(false);

  // Lifted Supabase provisioning controls (so step 0 can drive them)
  const listOrgs = useServerFn(listConnectedOrganizations);
  const provision = useServerFn(provisionTenantProject);
  const [chosenOrg, setChosenOrg] = useState<string>("");
  const [region, setRegion] = useState("us-east-1");

  const orgs = useQuery({
    queryKey: ["sb-orgs", siteId],
    queryFn: () => listOrgs({ data: { siteId } }),
    enabled: !!status.data?.hasRefreshToken && !status.data?.project,
  });

  const provisionMut = useMutation({
    mutationFn: () => provision({ data: { siteId, organizationId: chosenOrg, region } }),
    onSuccess: (r) => {
      toast.success(r.message);
      qc.invalidateQueries({ queryKey: ["provisioning-status", siteId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // If a project is already kicked off (refresh / returning user), auto-advance past step 0.
  useEffect(() => {
    if (step === 0 && status.data?.project) setStep(1);
  }, [status.data?.project, step]);

  useEffect(() => {
    if (profile && Object.keys(form).length === 0) setForm(profile);
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps


  const patch = (p: Partial<ManagedSiteDirectoryProfile>) => setForm((f) => ({ ...f, ...p }));

  const saveMut = useMutation({
    mutationFn: (payload: Parameters<typeof saveProfile>[0]["data"]) =>
      saveProfile({ data: payload }),
    onError: (e: Error) => toast.error(e.message),
  });

  const saveStep = async (next: Step | "finish") => {
    if (!profile) return;
    const payload: Parameters<typeof saveProfile>[0]["data"] = { siteId };
    if (step === 0) {
      // Project step: kick off provisioning (or skip if already started) before advancing.
      if (!status.data?.project) {
        if (!chosenOrg) {
          toast.error("Pick a Supabase organization");
          return;
        }
        try {
          await provisionMut.mutateAsync();
        } catch {
          return; // toast already shown
        }
      }
    }
    if (step === 1) {
      if (!form.display_name?.trim()) {
        toast.error("Please enter a station name");
        return;
      }
      payload.display_name = form.display_name;
    }
    if (step === 2) {
      payload.directory_tagline = form.directory_tagline ?? null;
      payload.directory_city = form.directory_city ?? null;
      payload.directory_region = form.directory_region ?? null;
      payload.directory_logo_url = form.directory_logo_url ?? null;
      payload.directory_website_url = form.directory_website_url ?? null;
      payload.directory_opt_in = !!form.directory_opt_in;
    }
    if (step === 3) {
      payload.custom_domain = form.custom_domain ?? null;
    }
    if (next === "finish") {
      payload.markOnboardingComplete = true;
    }
    if (Object.keys(payload).length > 1) {
      await saveMut.mutateAsync(payload);
      qc.invalidateQueries({ queryKey: ["managed-site-profile", siteId] });
      qc.invalidateQueries({ queryKey: ["my-managed-sites"] });
    }
    if (next === "finish") {
      setAnswersComplete(true);
      toast.success("Answers saved — you can launch your newsroom when provisioning completes.");
    } else {
      setStep(next);
    }
  };

  // Supabase connect modal — must come BEFORE the form is usable so background provisioning starts.
  const initiate = useServerFn(initiateSupabaseConnect);
  const hasConnected = !!status.data?.hasRefreshToken;
  const [connectOpen, setConnectOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const popupRef = useRef<Window | null>(null);

  // Auto-open the connect modal the first time we see we're not connected.
  useEffect(() => {
    if (status.isSuccess && !hasConnected) setConnectOpen(true);
    if (hasConnected) setConnectOpen(false);
  }, [status.isSuccess, hasConnected]);

  // Listen for the popup's postMessage so we refetch immediately on success.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "supabase-oauth") return;
      setConnecting(false);
      if (e.data.ok) {
        toast.success("Supabase connected — provisioning starts now.");
        qc.invalidateQueries({ queryKey: ["provisioning-status", siteId] });
      } else if (e.data.error) {
        toast.error(`Supabase: ${e.data.error}`);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [qc, siteId]);

  // While a popup is open, poll status so we close the modal even if postMessage is blocked.
  useEffect(() => {
    if (!connecting) return;
    const id = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["provisioning-status", siteId] });
      if (popupRef.current?.closed) {
        setConnecting(false);
        clearInterval(id);
      }
    }, 1500);
    return () => clearInterval(id);
  }, [connecting, qc, siteId]);

  const openSupabasePopup = async () => {
    try {
      setConnecting(true);
      const { authorizeUrl } = await initiate({ data: { siteId } });
      const w = 560;
      const h = 720;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      const popup = window.open(
        authorizeUrl,
        "supabase-oauth",
        `popup=yes,width=${w},height=${h},left=${left},top=${top}`,
      );
      if (!popup) {
        // Popup blocked — fall back to a full-page redirect.
        window.location.href = authorizeUrl;
        return;
      }
      popupRef.current = popup;
    } catch (e) {
      setConnecting(false);
      toast.error((e as Error).message);
    }
  };

  if (isLoading || !profile) {
    return <div className="mx-auto max-w-2xl p-10 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <Dialog
        open={connectOpen}
        onOpenChange={(o) => {
          // Block dismissal until connected — connecting Supabase is required first.
          if (!hasConnected) return;
          setConnectOpen(o);
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => !hasConnected && e.preventDefault()}
          onEscapeKeyDown={(e) => !hasConnected && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Connect your Supabase account</DialogTitle>
            <DialogDescription>
              We provision your newsroom database inside <strong>your own</strong> Supabase
              account so you fully own your data. This takes about a minute and runs in the
              background while you finish onboarding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={openSupabasePopup}
              disabled={connecting}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {connecting ? "Waiting for Supabase…" : "Connect Supabase →"}
            </button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              A Supabase window will open. After you authorize, it closes automatically and
              provisioning begins. Session code{" "}
              <span className="font-mono">{shortSessionCode(siteId)}</span>.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Link to="/account/managed-sites" className="hover:underline">
          ← My Affiliate Stations
        </Link>
        <span>
          Setup session{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
            {shortSessionCode(siteId)}
          </code>
        </span>
      </div>

      <h1 className="mt-3 font-display text-3xl font-black text-primary">
        Welcome to the Affiliate Network
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {hasConnected
          ? "While we get things ready in the background, let's set up your station."
          : "First, connect your Supabase account so we can provision your newsroom in the background."}
      </p>


      <div className="mt-6 grid gap-4 lg:grid-cols-10">
        {/* LEFT — Onboarding questions */}
        <div className="lg:col-span-7">
          <div
            aria-disabled={!hasConnected}
            className={`rounded-xl border bg-card p-6 shadow-sm ${
              hasConnected ? "" : "pointer-events-none select-none opacity-50"
            }`}
          >

            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-primary">
                {STEPS[step].blurb}
              </h2>
              <span className="text-xs text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </span>
            </div>

            <ol className="mt-4 grid grid-cols-5 gap-2">
              {STEPS.map((s) => (
                <li
                  key={s.key}
                  className={`rounded-md border px-2 py-1.5 text-center text-[11px] font-semibold ${
                    s.key === step
                      ? "border-primary bg-primary text-primary-foreground"
                      : s.key < step || answersComplete
                        ? "border-[color:var(--broadcast)] text-[color:var(--broadcast)]"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {s.key < step || answersComplete ? "✓ " : `${s.key + 1}. `}
                  {s.label}
                </li>
              ))}
            </ol>

            <div className="mt-6">
              {step === 0 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Pick which Supabase organization should own your newsroom database and where
                    it should live. We'll start provisioning in the background as soon as you
                    continue.
                  </p>
                  <Field label="Supabase organization">
                    <select
                      value={chosenOrg}
                      onChange={(e) => setChosenOrg(e.target.value)}
                      disabled={!!status.data?.project}
                      className="w-full rounded border px-3 py-2 text-sm"
                    >
                      <option value="">
                        {orgs.isLoading ? "Loading organizations…" : "— pick one —"}
                      </option>
                      {orgs.data?.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Region" hint="Pick the closest region to your readers.">
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      disabled={!!status.data?.project}
                      className="w-full rounded border px-3 py-2 text-sm"
                    >
                      <option value="us-east-1">US East (Virginia)</option>
                      <option value="us-west-1">US West (California)</option>
                      <option value="eu-west-1">EU West (Ireland)</option>
                      <option value="eu-central-1">EU Central (Frankfurt)</option>
                      <option value="ap-southeast-1">Asia (Singapore)</option>
                      <option value="ap-southeast-2">Asia (Sydney)</option>
                    </select>
                  </Field>
                  {status.data?.project && (
                    <p className="rounded-md border border-[color:var(--broadcast)]/40 bg-[color:var(--broadcast)]/10 p-3 text-xs text-[color:var(--broadcast)]">
                      ✓ Project already started — continuing won't create another.
                    </p>
                  )}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <Field label="Station name" hint="Shown to readers and in the directory.">
                    <input
                      value={form.display_name ?? ""}
                      onChange={(e) => patch({ display_name: e.target.value })}
                      className="w-full rounded border px-3 py-2 text-sm"
                      placeholder="e.g. Hudson Valley Daily"
                    />
                  </Field>
                  <p className="text-xs text-muted-foreground">
                    Your station URL is{" "}
                    <span className="font-mono">{profile.subdomain}.wkna49.com</span> — you can
                    map a custom domain in a moment.
                  </p>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <Field label="Tagline" hint="One sentence about what your station covers.">
                    <input
                      value={form.directory_tagline ?? ""}
                      onChange={(e) => patch({ directory_tagline: e.target.value })}
                      className="w-full rounded border px-3 py-2 text-sm"
                      maxLength={200}
                      placeholder="Independent news for the Hudson Valley."
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="City">
                      <input
                        value={form.directory_city ?? ""}
                        onChange={(e) => patch({ directory_city: e.target.value })}
                        className="w-full rounded border px-3 py-2 text-sm"
                        placeholder="Kingston"
                      />
                    </Field>
                    <Field label="State / Region">
                      <input
                        value={form.directory_region ?? ""}
                        onChange={(e) => patch({ directory_region: e.target.value })}
                        className="w-full rounded border px-3 py-2 text-sm"
                        placeholder="NY"
                      />
                    </Field>
                  </div>
                  <Field
                    label="Logo URL"
                    hint="Square image works best (PNG / SVG, hosted anywhere)."
                  >
                    <input
                      value={form.directory_logo_url ?? ""}
                      onChange={(e) => patch({ directory_logo_url: e.target.value })}
                      className="w-full rounded border px-3 py-2 text-sm font-mono"
                      placeholder="https://…/logo.png"
                    />
                  </Field>
                  <label className="flex items-start gap-2 rounded-md bg-muted/40 p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={!!form.directory_opt_in}
                      onChange={(e) => patch({ directory_opt_in: e.target.checked })}
                      className="mt-1"
                    />
                    <span>
                      <strong>List my station in the public Affiliate Stations directory.</strong>{" "}
                      <span className="text-muted-foreground">
                        Readers will see your name, tagline, logo, and a link to your site.
                      </span>
                    </span>
                  </label>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <Field
                    label="Custom domain"
                    hint="Optional. Skip for now and add it later from your station settings."
                  >
                    <input
                      value={form.custom_domain ?? ""}
                      onChange={(e) => patch({ custom_domain: e.target.value })}
                      className="w-full rounded border px-3 py-2 text-sm font-mono"
                      placeholder="news.example.com"
                    />
                  </Field>
                  <div className="rounded-md bg-muted/40 p-4 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">DNS setup</p>
                    <p className="mt-1">
                      Once you save, point a CNAME from your domain to{" "}
                      <span className="font-mono">{profile.subdomain}.wkna49.com</span>. Our team
                      will provision SSL automatically.
                    </p>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-3 text-sm">
                  <Row label="Station name" value={form.display_name} />
                  <Row label="Tagline" value={form.directory_tagline} />
                  <Row
                    label="Location"
                    value={
                      [form.directory_city, form.directory_region].filter(Boolean).join(", ") ||
                      "—"
                    }
                  />
                  <Row label="Logo URL" value={form.directory_logo_url} mono />
                  <Row
                    label="Custom domain"
                    value={form.custom_domain || "(using subdomain)"}
                    mono
                  />
                  <Row
                    label="Public directory"
                    value={form.directory_opt_in ? "Listed" : "Hidden"}
                  />
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep(Math.max(0, step - 1) as Step)}
                disabled={saveMut.isPending || provisionMut.isPending || step === 0}
                className="h-10 rounded-md border px-4 text-sm font-semibold disabled:opacity-40"
              >
                ← Back
              </button>
              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => saveStep((step + 1) as Step)}
                  disabled={
                    saveMut.isPending ||
                    provisionMut.isPending ||
                    (step === 0 && !status.data?.project && !chosenOrg)
                  }
                  className="h-10 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {provisionMut.isPending
                    ? "Starting provisioning…"
                    : saveMut.isPending
                      ? "Saving…"
                      : step === 0 && !status.data?.project
                        ? "Start provisioning & continue →"
                        : "Continue"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => saveStep("finish")}
                  disabled={saveMut.isPending || answersComplete}
                  className="h-10 rounded-md bg-[color:var(--breaking)] px-6 text-sm font-bold text-white disabled:opacity-50"
                >
                  {answersComplete
                    ? "✓ Answers saved"
                    : saveMut.isPending
                      ? "Saving…"
                      : "Save answers"}
                </button>
              )}
            </div>
          </div>
        </div>


        {/* RIGHT — Provisioning progress */}
        <div className="lg:col-span-3">
          <ProvisioningPanel
            siteId={siteId}
            sessionCode={shortSessionCode(siteId)}
            answersComplete={answersComplete}
            onOpenNewsroom={() => navigate({ to: "/account/managed-sites" })}
            onRetry={async () => {
              if (!chosenOrg) {
                setStep(0);
                toast.error("Pick a Supabase organization on step 1 before retrying.");
                return;
              }
              try {
                await provisionMut.mutateAsync();
              } catch {
                /* toast already shown */
              }
            }}
            retryDisabled={provisionMut.isPending}
          />
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Provisioning panel (right side)
// =====================================================================

function ProvisioningPanel({
  siteId,
  sessionCode,
  answersComplete,
  onOpenNewsroom,
  onRetry,
  retryDisabled,
}: {
  siteId: string;
  sessionCode: string;
  answersComplete: boolean;
  onOpenNewsroom: () => void;
  onRetry: () => void | Promise<void>;
  retryDisabled?: boolean;
}) {
  const fetchStatus = useServerFn(getProvisioningStatus);
  const initiate = useServerFn(initiateSupabaseConnect);
  const finalize = useServerFn(finalizeTenantProvisioning);
  const fetchAttempts = useServerFn(listProvisionAttempts);
  const resetForRetry = useServerFn(resetProvisioningForRetry);

  const status = useQuery({
    queryKey: ["provisioning-status", siteId],
    queryFn: () => fetchStatus({ data: { siteId } }),
    refetchInterval: (q) => {
      const s = q.state.data?.state;
      return s === "provisioning" || s === "migrating" || s === "linking" ? 4000 : false;
    },
  });

  // Auto-finalize when project is in provisioning/migrating state
  const finalizingRef = useRef(false);
  useEffect(() => {
    const s = status.data?.state;
    if ((s === "provisioning" || s === "migrating") && status.data?.project && !finalizingRef.current) {
      finalizingRef.current = true;
      finalize({ data: { siteId } })
        .catch(() => {
          /* silent — next poll will retry */
        })
        .finally(() => {
          setTimeout(() => {
            finalizingRef.current = false;
            status.refetch();
          }, 1500);
        });
    }
  }, [status.data?.state, status.data?.project]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rotating flavor messages
  const [msgIdx, setMsgIdx] = useState(() => Math.floor(Math.random() * FLAVOR_MESSAGES.length));
  useEffect(() => {
    const s = status.data?.state;
    if (s === "ready" || s === "failed") return;
    const t = setInterval(
      () => setMsgIdx((i) => (i + 1) % FLAVOR_MESSAGES.length),
      6000,
    );

    return () => clearInterval(t);
  }, [status.data?.state]);

  // Smoothly animate progress toward target percent
  const targetPct = STATE_PCT[status.data?.state ?? "awaiting_oauth"] ?? 0;
  const [pct, setPct] = useState(targetPct);
  useEffect(() => {
    const id = setInterval(() => {
      setPct((p) => {
        if (p >= targetPct) return targetPct;
        return Math.min(targetPct, p + 0.6);
      });
    }, 120);
    return () => clearInterval(id);
  }, [targetPct]);

  const s = status.data;
  const stateLabel = useMemo(() => {
    switch (s?.state) {
      case "awaiting_oauth":
        return "Awaiting Supabase authorization";
      case "linking":
        return "Linking your Supabase account";
      case "provisioning":
        return "Provisioning database…";
      case "migrating":
        return "Running newsroom migrations…";
      case "ready":
        return "Connected";
      case "failed":
        return "Provisioning failed";
      default:
        return "Initializing…";
    }
  }, [s?.state]);

  const startConnect = async () => {
    try {
      const { authorizeUrl } = await initiate({ data: { siteId } });
      window.location.href = authorizeUrl;
    } catch (e) {
      toast.error((e as Error).message);
    }
  };


  const isReady = s?.state === "ready";
  const isFailed = s?.state === "failed";

  return (
    <div className="sticky top-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Provisioning
        </p>
        <code
          className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
          title="Quote this code if you need support"
        >
          {sessionCode}
        </code>
      </div>

      {/* Spinner + percent */}
      <div className="mt-4 flex flex-col items-center">
        <CircularProgress percent={pct} state={isReady ? "ready" : isFailed ? "failed" : "active"} />
        <p className="mt-3 text-sm font-semibold text-foreground">{stateLabel}</p>
        {!isReady && !isFailed && (
          <p
            key={msgIdx}
            className="mt-1 min-h-[2.2em] animate-fade-in text-center text-xs italic text-muted-foreground"
          >
            {FLAVOR_MESSAGES[msgIdx]}
          </p>
        )}
        {isFailed && s?.error && (
          <p className="mt-1 text-center text-xs text-[color:var(--breaking)]">{s.error}</p>
        )}
      </div>

      {/* Action area depending on phase */}
      <div className="mt-5 space-y-3 text-sm">
        {!s?.hasRefreshToken && !isReady && (
          <button
            type="button"
            onClick={startConnect}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Connect Supabase →
          </button>
        )}

        {s?.hasRefreshToken && !s?.project && !isReady && (
          <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            Pick your Supabase organization and region on the left, then hit{" "}
            <strong>Start provisioning &amp; continue</strong>.
          </p>
        )}

        {isReady && (
          <div className="space-y-3 text-center">
            <div className="flex flex-col items-center gap-1 rounded-md border border-[color:var(--broadcast)]/40 bg-[color:var(--broadcast)]/10 p-3">
              <SupabaseLogo className="h-8 w-8" />
              <p className="text-sm font-bold text-[color:var(--broadcast)]">Connected</p>
              {s.project?.ref && (
                <p className="text-[10px] font-mono text-muted-foreground">{s.project.ref}</p>
              )}
            </div>
            <a
              href={
                s.project?.ref
                  ? `https://supabase.com/dashboard/project/${s.project.ref}`
                  : "https://supabase.com/dashboard"
              }
              target="_blank"
              rel="noreferrer"
              className="block w-full rounded-md border px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              Open Supabase Admin →
            </a>
            <button
              type="button"
              onClick={onOpenNewsroom}
              disabled={!answersComplete}
              title={
                answersComplete
                  ? "Open your newsroom"
                  : "Finish the onboarding questions to unlock"
              }
              className="block w-full rounded-md bg-[color:var(--breaking)] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Open Newsroom Admin →
            </button>
            {!answersComplete && (
              <p className="text-[11px] text-muted-foreground">
                Finish the questions on the left to unlock your newsroom.
              </p>
            )}
          </div>
        )}

        {isFailed && (
          <div className="space-y-2">
            <button
              type="button"
              disabled={retryDisabled}
              onClick={async () => {
                try {
                  await resetForRetry({ data: { siteId } });
                  await onRetry();
                  status.refetch();
                  attempts.refetch();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              className="w-full rounded-md bg-[color:var(--breaking)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {retryDisabled ? "Retrying…" : "Retry provisioning"}
            </button>
            <button
              type="button"
              onClick={() => {
                status.refetch();
                attempts.refetch();
              }}
              className="w-full rounded-md border px-4 py-2 text-xs font-semibold"
            >
              Refresh status
            </button>
          </div>
        )}
      </div>

      <AttemptsList query={attempts} />

      <p className="mt-4 border-t pt-3 text-[10px] leading-relaxed text-muted-foreground">
        Safe to refresh — we'll resume right where you left off. If something goes wrong, share
        session code <span className="font-mono">{sessionCode}</span> with support.
      </p>
    </div>
  );
}

function AttemptsList({
  query,
}: {
  query: ReturnType<typeof useQuery<ProvisionAttempt[]>>;
}) {
  const rows = query.data ?? [];
  if (!rows.length) return null;
  const badge = (status: ProvisionAttempt["status"]) => {
    const map: Record<ProvisionAttempt["status"], string> = {
      succeeded: "bg-[color:var(--broadcast)]/15 text-[color:var(--broadcast)]",
      reclaimed: "bg-amber-500/15 text-amber-600",
      failed: "bg-[color:var(--breaking)]/15 text-[color:var(--breaking)]",
      pending: "bg-muted text-muted-foreground",
      abandoned: "bg-muted text-muted-foreground line-through",
    };
    return (
      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${map[status]}`}>
        {status}
      </span>
    );
  };
  return (
    <details className="mt-4 rounded-md border bg-muted/30 p-2 text-xs">
      <summary className="cursor-pointer font-semibold text-muted-foreground">
        Setup attempts ({rows.length})
      </summary>
      <ul className="mt-2 space-y-2">
        {rows.map((a) => (
          <li key={a.id} className="rounded border bg-background p-2">
            <div className="flex items-center justify-between gap-2">
              <code className="truncate font-mono text-[10px]">{a.attempted_project_name}</code>
              {badge(a.status)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{new Date(a.started_at).toLocaleString()}</span>
              <code className="font-mono">{a.session_code}</code>
            </div>
            {a.error && (
              <p className="mt-1 text-[10px] text-[color:var(--breaking)]">{a.error}</p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

// =====================================================================
// Bits
// =====================================================================

function CircularProgress({
  percent,
  state,
}: {
  percent: number;
  state: "active" | "ready" | "failed";
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  const color =
    state === "ready"
      ? "var(--broadcast)"
      : state === "failed"
        ? "var(--breaking)"
        : "var(--primary)";
  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-muted"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.3s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-foreground">{Math.round(percent)}%</span>
        {state === "ready" && (
          <span className="text-[10px] font-semibold uppercase text-[color:var(--broadcast)]">
            Done
          </span>
        )}
        {state === "failed" && (
          <span className="text-[10px] font-semibold uppercase text-[color:var(--breaking)]">
            Error
          </span>
        )}
      </div>
    </div>
  );
}

function SupabaseLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 109 113" className={className} aria-hidden>
      <path
        d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627H99.1935C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"
        fill="#3ECF8E"
      />
      <path
        d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z"
        fill="#3ECF8E"
        fillOpacity="0.5"
      />
    </svg>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="font-semibold text-foreground">{label}</span>
      {hint && <span className="ml-2 text-xs text-muted-foreground">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-2 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={`text-right text-foreground ${mono ? "font-mono text-xs" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}
