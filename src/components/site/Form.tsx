import { type FormHTMLAttributes, type ReactNode, useState } from "react";
import { CheckCircle2 } from "lucide-react";

type Field =
  | { name: string; label: string; type?: "text" | "email" | "tel" | "url" | "date"; required?: boolean; placeholder?: string }
  | { name: string; label: string; type: "textarea"; required?: boolean; placeholder?: string; rows?: number }
  | { name: string; label: string; type: "select"; required?: boolean; options: string[] };

export function FormBlock({
  intro,
  fields,
  submitLabel = "Submit",
  successTitle = "Thanks — we received your submission.",
  successBody = "A member of our team will review it shortly.",
  ...rest
}: {
  intro?: ReactNode;
  fields: Field[];
  submitLabel?: string;
  successTitle?: string;
  successBody?: string;
} & FormHTMLAttributes<HTMLFormElement>) {
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-[color:var(--broadcast)]" />
        <h3 className="mt-3 font-display text-2xl font-bold text-primary">{successTitle}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{successBody}</p>
      </div>
    );
  }
  return (
    <form
      {...rest}
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
      }}
      className="space-y-5 rounded-lg border bg-card p-6 sm:p-8"
    >
      {intro && <div className="text-sm text-muted-foreground">{intro}</div>}
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((f) => {
          const full =
            f.type === "textarea" ||
            ["message", "details", "description", "summary"].includes(f.name);
          return (
            <div key={f.name} className={full ? "sm:col-span-2" : ""}>
              <label htmlFor={f.name} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-primary">
                {f.label}
                {f.required && <span className="text-[color:var(--breaking)]"> *</span>}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  id={f.name}
                  name={f.name}
                  required={f.required}
                  rows={f.rows ?? 5}
                  placeholder={f.placeholder}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-[color:var(--broadcast)] focus:outline-none"
                />
              ) : f.type === "select" ? (
                <select
                  id={f.name}
                  name={f.name}
                  required={f.required}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:border-[color:var(--broadcast)] focus:outline-none"
                >
                  <option value="">Select…</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={f.name}
                  name={f.name}
                  type={f.type ?? "text"}
                  required={f.required}
                  placeholder={f.placeholder}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:border-[color:var(--broadcast)] focus:outline-none"
                />
              )}
            </div>
          );
        })}
      </div>
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
      >
        {submitLabel}
      </button>
    </form>
  );
}
