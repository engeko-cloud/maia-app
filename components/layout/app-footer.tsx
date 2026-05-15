import { FapptoryAttribution } from "@/components/brand/fapptory-attribution";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";

interface AppFooterProps {
  className?: string;
}

export function AppFooter({ className }: AppFooterProps) {
  return (
    <footer
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 h-14 border-t border-border bg-[var(--color-bg-subtle)]",
        className,
      )}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4 text-xs text-[var(--color-fg-muted)]">
        <span className="truncate">
          MAIA
          <span aria-hidden="true" className="mx-1">·</span>
          <span className="hidden sm:inline">
            Gestão de Saúde Ocupacional
            <span aria-hidden="true" className="mx-1">·</span>
          </span>
          Licenciado para ENGEKO
        </span>
        <span className="inline-flex shrink-0 items-center gap-3">
          <FapptoryAttribution size="sm" />
          <span aria-hidden="true">·</span>
          <span className="font-mono text-[var(--color-fg-subtle)]">v{APP_VERSION}</span>
        </span>
      </div>
    </footer>
  );
}
