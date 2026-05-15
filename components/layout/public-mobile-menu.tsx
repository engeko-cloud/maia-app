"use client";

import * as React from "react";
import Link from "next/link";
import { MenuIcon, CircleUserRoundIcon, ExternalLinkIcon, ChevronDownIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { publicNav } from "@/lib/public-nav";

interface PublicMobileMenuProps {
  user: { firstName: string } | null;
}

export function PublicMobileMenu({ user }: PublicMobileMenuProps) {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Abrir menu"
            className="md:hidden"
          />
        }
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col gap-4 p-6">
        <SheetHeader className="p-0">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>

        {/* Portal entry — top of the sheet */}
        <Link
          href="/portal/login"
          onClick={close}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <CircleUserRoundIcon className="size-4" aria-hidden="true" />
          Portal do colaborador
        </Link>

        <nav aria-label="Navegação principal" className="flex flex-col gap-1">
          {publicNav.map((group) =>
            group.items.length === 0 ? (
              <Link
                key={group.id}
                href={group.href}
                onClick={close}
                className="rounded-md px-3 py-2 text-base font-medium text-[var(--color-fg-muted)] hover:bg-muted hover:text-foreground"
              >
                {group.label}
              </Link>
            ) : (
              <details key={group.id} className="group">
                <summary
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-base font-medium text-[var(--color-fg-muted)]",
                    "hover:bg-muted hover:text-foreground",
                    "[&::-webkit-details-marker]:hidden",
                  )}
                >
                  {group.label}
                  <ChevronDownIcon
                    className="size-4 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="ml-2 mt-1 flex flex-col gap-0.5 border-l border-border pl-2">
                  {group.items.map((item) =>
                    item.external ? (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={close}
                        className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-[var(--color-fg-muted)] hover:bg-muted hover:text-foreground"
                      >
                        {item.label}
                        <ExternalLinkIcon className="size-3.5 opacity-60" aria-hidden="true" />
                      </a>
                    ) : (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={close}
                        className="rounded-md px-3 py-2 text-sm text-[var(--color-fg-muted)] hover:bg-muted hover:text-foreground"
                      >
                        {item.label}
                      </Link>
                    ),
                  )}
                </div>
              </details>
            ),
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
          {user ? (
            <Link
              href="/painel"
              onClick={close}
              className="rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
            >
              Painel →
            </Link>
          ) : (
            <Link
              href="/login"
              onClick={close}
              className="rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
            >
              Entrar
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
