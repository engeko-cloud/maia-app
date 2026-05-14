import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface DetailHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  /** Optional mono suffix appended to title (e.g. record ID, CPF). */
  titleSuffix?: string;
  /** Meta row beneath the title — status pill, dates, urgency callout. */
  meta?: React.ReactNode;
  /** Right-aligned action slot. */
  actions?: React.ReactNode;
}

export function DetailHeader({ breadcrumbs, title, titleSuffix, meta, actions }: DetailHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-3 border-b border-[var(--color-border)] pb-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-[var(--color-fg-muted)]">
        {breadcrumbs.map((b, i) => {
          const last = i === breadcrumbs.length - 1;
          return (
            <span key={`${b.label}-${i}`} className="inline-flex items-center gap-1">
              {b.href && !last ? (
                <Link href={b.href} className="hover:text-foreground">{b.label}</Link>
              ) : (
                <span className={cn(last && "text-foreground")}>{b.label}</span>
              )}
              {!last && <ChevronRightIcon className="size-3 text-[var(--color-fg-subtle)]" aria-hidden="true" />}
            </span>
          );
        })}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
          {titleSuffix && (
            <span className="ml-2 font-mono text-base font-normal text-[var(--color-fg-muted)]">
              {titleSuffix}
            </span>
          )}
        </h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {meta && <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-fg-muted)]">{meta}</div>}
    </header>
  );
}
