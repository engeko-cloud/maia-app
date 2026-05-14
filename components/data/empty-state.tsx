import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, hint, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-6 py-12 text-center">
      {Icon && (
        <span className="grid size-10 place-items-center rounded-md bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-sm text-xs text-[var(--color-fg-muted)]">{hint}</p>}
      {action}
    </div>
  );
}
