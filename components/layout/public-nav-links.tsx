"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppNavMenu } from "@/components/layout/app-nav-menu";
import { cn } from "@/lib/utils";
import { publicNav } from "@/lib/public-nav";

interface PublicNavLinksProps {
  className?: string;
}

export function PublicNavLinks({ className }: PublicNavLinksProps) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Navegação principal"
      className={cn("flex items-center gap-1 text-sm", className)}
    >
      {publicNav.map((group) => {
        if (group.items.length === 0) {
          const active = pathname === group.href;
          return (
            <Link
              key={group.id}
              href={group.href}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                active
                  ? "bg-muted text-foreground"
                  : "text-[var(--color-fg-muted)] hover:bg-muted hover:text-foreground",
              )}
            >
              {group.label}
            </Link>
          );
        }
        const active = group.items.some(
          (i) => !i.external && pathname.startsWith(i.href),
        );
        return <AppNavMenu key={group.id} group={group} active={active} />;
      })}
    </nav>
  );
}
