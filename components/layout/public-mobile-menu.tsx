"use client";

import * as React from "react";
import Link from "next/link";
import { MenuIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PublicNavLinks } from "@/components/layout/public-nav-links";

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
      <SheetContent side="right" className="flex flex-col gap-6 p-6">
        <SheetHeader className="p-0">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <PublicNavLinks />
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
