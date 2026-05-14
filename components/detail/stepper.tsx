import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperStep {
  label: string;
}

interface StepperProps {
  steps: StepperStep[];
  /** Zero-based current step index. */
  current: number;
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex items-center gap-2" aria-label="Etapas">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                done && "bg-[var(--color-success)] text-white",
                active && "bg-[var(--brand-primary-600)] text-white",
                !done && !active && "bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]",
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? <CheckIcon className="size-4" aria-hidden="true" /> : i + 1}
            </span>
            <span
              className={cn(
                "relative flex-1 truncate text-sm",
                active ? "font-semibold text-foreground" : "text-[var(--color-fg-muted)]",
              )}
            >
              {s.label}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1 left-0 h-[2px] w-8 bg-[var(--brand-accent-500)]"
                />
              )}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="h-px flex-1 bg-[var(--color-border)]" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
