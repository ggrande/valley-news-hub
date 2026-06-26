import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getMyManagedSiteProfile,
  updateMyManagedSiteProfile,
  type ManagedSiteDirectoryProfile,
} from "@/lib/affiliate-directory.functions";

export const Route = createFileRoute("/_authenticated/account/managed-sites/$siteId/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome — Set up your Affiliate Station" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

type Step = 0 | 1 | 2 | 3;

const STEPS: { key: Step; label: string; blurb: string }[] = [
  { key: 0, label: "Identity", blurb: "Name your affiliate station" },
  { key: 1, label: "Branding", blurb: "Logo & tagline for the directory" },
  { key: 2, label: "Domain", blurb: "Connect a custom domain (optional)" },
  { key: 3, label: "Go live", blurb: "Review and finish" },
];

function OnboardingPage() {
  const { siteId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyManagedSiteProfile);
  const saveProfile = useServerFn(updateMyManagedSiteProfile);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["managed-site-profile", siteId],
    queryFn: () => fetchProfile({ data: { siteId } }),
  });

  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<Partial<ManagedSiteDirectoryProfile>>({});

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
      if (!form.display_name?.trim()) {
        toast.error("Please enter a station name");
        return;
      }
      payload.display_name = form.display_name;
    }
    if (step === 1) {
      payload.directory_tagline = form.directory_tagline ?? null;
      payload.directory_city = form.directory_city ?? null;
      payload.directory_region = form.directory_region ?? null;
      payload.directory_logo_url = form.directory_logo_url ?? null;
      payload.directory_website_url = form.directory_website_url ?? null;
      payload.directory_opt_in = !!form.directory_opt_in;
    }
    if (step === 2) {
      payload.custom_domain = form.custom_domain ?? null;
    }
    if (next === "finish") {
      payload.markOnboardingComplete = true;
    }
    await saveMut.mutateAsync(payload);
    qc.invalidateQueries({ queryKey: ["managed-site-profile", siteId] });
    qc.invalidateQueries({ queryKey: ["my-managed-sites"] });
    if (next === "finish") {
      toast.success("Your affiliate station is set up!");
      navigate({ to: "/account/managed-sites" });
    } else {
      setStep(next);
    }
  };

  if (isLoading || !profile) {
    return <div className="mx-auto max-w-2xl p-10 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Link to="/account/managed-sites" className="hover:underline">
          ← My Affiliate Stations
        </Link>
        <span>Step {step + 1} of {STEPS.length}</span>
      </div>

      <h1 className="mt-3 font-display text-3xl font-black text-primary">
        Welcome to the Affiliate Network
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A few quick details and your Affiliate Station is ready to publish.
      </p>

      <ol className="mt-6 grid grid-cols-4 gap-2">
        {STEPS.map((s) => (
          <li
            key={s.key}
            className={`rounded-md border px-3 py-2 text-center text-xs font-semibold ${
              s.key === step
                ? "border-primary bg-primary text-primary-foreground"
                : s.key < step
                  ? "border-[color:var(--broadcast)] text-[color:var(--broadcast)]"
                  : "border-border text-muted-foreground"
            }`}
          >
            {s.key < step ? "✓ " : `${s.key + 1}. `}
            {s.label}
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-primary">{STEPS[step].blurb}</h2>

        {step === 0 && (
          <div className="mt-5 space-y-4">
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
              <span className="font-mono">{profile.subdomain}.wkna49.com</span> — you can map a
              custom domain in step 3.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="mt-5 space-y-4">
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
            <Field label="Logo URL" hint="Square image works best (PNG / SVG, hosted anywhere).">
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

        {step === 2 && (
          <div className="mt-5 space-y-4">
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
                <span className="font-mono">{profile.subdomain}.wkna49.com</span>. Our team will
                provision SSL automatically.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-5 space-y-3 text-sm">
            <Row label="Station name" value={form.display_name} />
            <Row label="Tagline" value={form.directory_tagline} />
            <Row
              label="Location"
              value={[form.directory_city, form.directory_region].filter(Boolean).join(", ") || "—"}
            />
            <Row label="Logo URL" value={form.directory_logo_url} mono />
            <Row label="Custom domain" value={form.custom_domain || "(using subdomain)"} mono />
            <Row
              label="Public directory"
              value={form.directory_opt_in ? "Listed" : "Hidden"}
            />
            <p className="mt-4 text-xs text-muted-foreground">
              You can change any of this anytime from your station settings.
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-between gap-2">
          <button
            type="button"
            onClick={() => setStep(Math.max(0, step - 1) as Step)}
            disabled={step === 0 || saveMut.isPending}
            className="h-10 rounded-md border px-4 text-sm font-semibold disabled:opacity-40"
          >
            ← Back
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => saveStep((step + 1) as Step)}
              disabled={saveMut.isPending}
              className="h-10 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saveMut.isPending ? "Saving…" : "Continue"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => saveStep("finish")}
              disabled={saveMut.isPending}
              className="h-10 rounded-md bg-[color:var(--breaking)] px-6 text-sm font-bold text-white disabled:opacity-50"
            >
              {saveMut.isPending ? "Finishing…" : "Finish setup"}
            </button>
          )}
        </div>
      </div>
    </div>
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
