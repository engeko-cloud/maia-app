import { cn } from "@/lib/utils";
import { resolveStatusPill, type StatusDomain, type StatusTone } from "@/lib/status-pill";

const TONE_CLASS: Record<StatusTone, string> = {
  pending:       "bg-[var(--color-accent-soft)] text-[var(--brand-accent-600)]",
  approved:      "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  rejected:      "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  draft:         "bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]",
  success:       "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  new:           "bg-[var(--color-info-soft)] text-[var(--color-info)]",
  investigating: "bg-[var(--color-info-soft)] text-[var(--color-info)]",
};

interface StatusPillProps {
  domain: StatusDomain;
  situacao: string;
  className?: string;
}

export function StatusPill({ domain, situacao, className }: StatusPillProps) {
  const spec = resolveStatusPill(domain, situacao);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        TONE_CLASS[spec.tone],
        className,
      )}
    >
      {spec.label}
    </span>
  );
}
