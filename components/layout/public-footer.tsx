import { LogoMark } from "@/components/brand/logo-mark";
import { APP_VERSION } from "@/lib/version";

export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-[var(--color-bg-subtle)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-[var(--color-fg-muted)]">
        <span className="inline-flex items-center gap-2">
          <LogoMark size="sm" muted />
          <span>
            MAIA{" "}
            <span aria-hidden="true" className="mx-1">·</span>
            Plataforma de Saúde Ocupacional
            <span aria-hidden="true" className="mx-1">·</span>
            © {year} ENGEKO
          </span>
        </span>
        <span className="font-mono text-[var(--color-fg-subtle)]">v{APP_VERSION}</span>
      </div>
    </footer>
  );
}
