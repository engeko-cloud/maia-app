import { cn } from "@/lib/utils";

export interface Field {
  label: string;
  value: React.ReactNode;
  /** Use the mono font for IDs / CPF / dates. */
  mono?: boolean;
  /** Span the full row width (2 cols). */
  full?: boolean;
}

interface FieldGridProps {
  fields: Field[];
  className?: string;
}

export function FieldGrid({ fields, className }: FieldGridProps) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {fields.map((f, i) => (
        <div key={`${f.label}-${i}`} className={cn("flex flex-col gap-1", f.full && "sm:col-span-2")}>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
            {f.label}
          </dt>
          <dd className={cn("text-sm text-foreground", f.mono && "font-mono text-[13px]")}>
            {f.value ?? <span className="text-[var(--color-fg-subtle)]">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
