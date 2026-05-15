import { cn } from "@/lib/utils";

export type MetricTone = "ok" | "warn" | "error" | "neutral";

interface MetricCardProps {
  label: string;
  value: number | string;
  delta?: string;
  tone?: MetricTone;
  children?: React.ReactNode;
}

const toneStrip: Record<MetricTone, string> = {
  ok:      "bg-[var(--brand-primary-600)]",
  warn:    "bg-amber-400",
  error:   "bg-red-500",
  neutral: "bg-[var(--brand-accent-500)]",
};

const toneBg: Record<MetricTone, string> = {
  ok:      "bg-white",
  warn:    "bg-amber-50",
  error:   "bg-red-50",
  neutral: "bg-white",
};

const toneText: Record<MetricTone, string> = {
  ok:      "text-foreground",
  warn:    "text-amber-700",
  error:   "text-red-700",
  neutral: "text-foreground",
};

export function MetricCard({ label, value, delta, tone = "neutral", children }: MetricCardProps) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-md border border-[var(--color-border)] p-5 shadow-[var(--shadow-xs)]",
      toneBg[tone],
    )}>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
        {label}
      </p>
      <p className={cn("mt-2 text-3xl font-semibold tracking-tight", toneText[tone])}>
        {value}
      </p>
      {delta && (
        <p className="mt-1 text-xs text-[var(--color-fg-muted)]">{delta}</p>
      )}
      {children && (
        <div className="mt-3 border-t border-[var(--color-border)] pt-3">
          {children}
        </div>
      )}
      <span aria-hidden="true" className={cn("absolute inset-x-0 bottom-0 h-[2px]", toneStrip[tone])} />
    </div>
  );
}
