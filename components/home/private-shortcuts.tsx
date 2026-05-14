import Link from "next/link";
import { ChevronRightIcon, LayoutDashboardIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface PrivateShortcutsProps {
  user: { firstName: string } | null;
}

export function PrivateShortcuts({ user }: PrivateShortcutsProps) {
  if (!user) return null;

  return (
    <Card className="ring-[var(--brand-accent-500)]/30 bg-[var(--brand-accent-50)]/40">
      <CardHeader>
        <CardTitle>Atalhos privados</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-2 pb-2">
        <Link
          href="/painel"
          className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-white/50"
        >
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--brand-accent-500)] text-white"
          >
            <LayoutDashboardIcon className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium text-foreground">Painel →</span>
            <span className="text-sm text-[var(--color-fg-muted)]">
              Sua visão operacional do dia.
            </span>
          </span>
          {/* Phase 4 will replace this slot with a pendências count badge. */}
          <span aria-hidden="true" className="shrink-0 text-[var(--color-fg-subtle)]">
            <ChevronRightIcon className="size-4" />
          </span>
        </Link>
      </CardContent>
    </Card>
  );
}
