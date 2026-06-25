import { useEffect, useState } from "react";
import { AlertTriangle, Download, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * NetworkUpdateBanner — ships with WKNA platform code.
 *
 * In self-hosted deployments, set these env vars at build time:
 *   VITE_NETWORK_LICENSE_KEY   – the buyer's license key
 *   VITE_PLATFORM_VERSION      – current build's semver (e.g. "1.4.2")
 *   VITE_NETWORK_UPDATE_HOST   – upstream WKNA host (default: https://wkna49.com)
 *
 * When any are missing (e.g. on the canonical WKNA 49 site itself), the
 * banner renders nothing — admins of the source-of-truth site don't need
 * to be told to update themselves.
 */
type CheckResult = {
  current: string;
  latest: string | null;
  up_to_date: boolean;
  breaking?: boolean;
  security?: boolean;
  changelog_url?: string;
  download_url?: string | null;
};

const DISMISS_KEY = "wkna-network-update-dismissed-version";

export function NetworkUpdateBanner() {
  const license = import.meta.env.VITE_NETWORK_LICENSE_KEY as string | undefined;
  const version = (import.meta.env.VITE_PLATFORM_VERSION as string | undefined) ?? "0.0.0";
  const host = (import.meta.env.VITE_NETWORK_UPDATE_HOST as string | undefined) ?? "https://wkna49.com";

  const [result, setResult] = useState<CheckResult | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!license) return;
    setDismissed(typeof window !== "undefined" ? localStorage.getItem(DISMISS_KEY) : null);
    const url = `${host}/api/public/network/check-update?license=${encodeURIComponent(
      license,
    )}&v=${encodeURIComponent(version)}`;
    fetch(url, { method: "GET" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CheckResult | null) => {
        if (data) setResult(data);
      })
      .catch(() => {});
  }, [license, version, host]);

  if (!license || !result || result.up_to_date || !result.latest) return null;
  if (dismissed === result.latest && !result.security) return null;

  const tone = result.security
    ? "bg-red-600 text-white"
    : result.breaking
      ? "bg-amber-500 text-amber-950"
      : "bg-primary text-primary-foreground";

  return (
    <div className={`${tone} px-4 py-2 text-sm flex items-center gap-3`}>
      {result.security ? <ShieldAlert className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
      <div className="flex-1">
        <strong>WKNA Platform v{result.latest} available</strong>{" "}
        <span className="opacity-90">
          (you're on v{version}
          {result.security ? " — includes security fixes" : result.breaking ? " — breaking changes" : ""}
          ).
        </span>
      </div>
      {result.changelog_url && (
        <a href={result.changelog_url} target="_blank" rel="noreferrer" className="underline text-xs">
          Changelog
        </a>
      )}
      {result.download_url && (
        <Button asChild size="sm" variant="secondary" className="h-7">
          <a href={result.download_url} target="_blank" rel="noreferrer">
            <Download className="h-3 w-3 mr-1" /> Download
          </a>
        </Button>
      )}
      {!result.security && (
        <button
          aria-label="Dismiss"
          className="opacity-80 hover:opacity-100"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, result.latest!);
            setDismissed(result.latest);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
