import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperStep {
  label: string;
}

interface StepperProps {
  steps: StepperStep[];
  /** Zero-based current step index. */
  current: number;
  /** When provided, step indicators become clickable buttons. */
  onStepClick?: (index: number) => void;
}

export function Stepper({ steps, current, onStepClick }: StepperProps) {
  return (
    <ol className="flex items-center gap-2" aria-label="Etapas">
      {steps.map((s, i) => {
        const done   = i < current;
        const active = i === current;

        const indicator = (
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
              done   && "bg-[var(--color-success)] text-white",
              active && "bg-[var(--brand-primary-600)] text-white",
              !done && !active && "bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]",
            )}
          >
            {done ? <CheckIcon className="size-4" aria-hidden="true" /> : i + 1}
          </span>
        );

        return (
          <li key={s.label} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
            {onStepClick ? (
              <button
                type="button"
                aria-label={`Ir para etapa ${s.label}`}
                onClick={() => onStepClick(i)}
                className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary-600)] rounded-full"
              >
                {indicator}
              </button>
            ) : indicator}

            <span
              className={cn(
                "relative flex-1 truncate text-sm",
                active ? "font-semibold text-foreground" : "text-[var(--color-fg-muted)]",
              )}
            >
              {s.label}
              {active && (
                <span aria-hidden="true" className="absolute -bottom-1 left-0 h-[2px] w-8 bg-[var(--brand-accent-500)]" />
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
