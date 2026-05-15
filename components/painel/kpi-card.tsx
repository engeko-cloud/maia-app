import { cn } from "@/lib/utils";

export type KpiCardTone = "primary" | "accent" | "warning";

interface KpiCardProps {
  label: string;
  value: number | string;
  delta?: string;
  tone?: KpiCardTone;
}

const toneStrip: Record<KpiCardTone, string> = {
  primary: "bg-[var(--brand-primary-600)]",
  accent:  "bg-[var(--brand-accent-500)]",
  warning: "bg-[var(--color-warning)]",
};

export function KpiCard({ label, value, delta, tone = "primary" }: KpiCardProps) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-xs)]">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      {delta && (
        <p className="mt-1 text-xs text-[var(--color-fg-muted)]">{delta}</p>
      )}
      <span aria-hidden="true" className={cn("absolute inset-x-0 bottom-0 h-[2px]", toneStrip[tone])} />
    </div>
  );
}
