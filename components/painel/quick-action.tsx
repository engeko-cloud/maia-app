import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuickActionTone = "primary" | "accent";

interface QuickActionProps {
  href: string;
  icon: LucideIcon;
  title: string;
  sub: string;
  tone?: QuickActionTone;
  /** Optional count pill in the top-right (e.g., pending count). */
  count?: number;
}

const toneMap: Record<QuickActionTone, { chip: string; strip: string }> = {
  primary: {
    chip: "bg-[var(--brand-primary-50)] text-[var(--brand-primary-600)]",
    strip: "bg-[var(--brand-primary-600)]",
  },
  accent: {
    chip: "bg-[var(--brand-accent-50)] text-[var(--brand-accent-500)]",
    strip: "bg-[var(--brand-accent-500)]",
  },
};

export function QuickAction({
  href, icon: Icon, title, sub, tone = "accent", count,
}: QuickActionProps) {
  const t = toneMap[tone];
  return (
    <Link
      href={href}
      className="group relative flex items-start gap-3 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-xs)] transition hover:shadow-[var(--shadow-md)]"
    >
      <span
        aria-hidden="true"
        className={cn("grid size-10 place-items-center rounded-[var(--radius-lg)]", t.chip)}
      >
        <Icon className="size-5" />
      </span>
      <span className="flex flex-1 flex-col">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-xs text-[var(--color-fg-muted)]">{sub}</span>
      </span>
      {typeof count === "number" && count > 0 && (
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--brand-accent-500)] px-1.5 text-xs font-semibold text-white">
          {count}
        </span>
      )}
      <span aria-hidden="true" className={cn("absolute inset-x-0 bottom-0 h-[2px]", t.strip)} />
    </Link>
  );
}
