"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppNavMenu } from "@/components/layout/app-nav-menu";
import { cn } from "@/lib/utils";
import type { AppNavGroup } from "@/lib/nav";

interface AppNavRowProps {
  groups: AppNavGroup[];
}

function isActive(pathname: string, group: AppNavGroup): boolean {
  if (group.href === "/app/painel") return pathname === "/app/painel";
  return pathname === group.href || pathname.startsWith(`${group.href}/`);
}

export function AppNavRow({ groups }: AppNavRowProps) {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Navegação principal" className="hidden items-center gap-1 md:flex">
      {groups.map((group) => {
        const active = isActive(pathname, group);
        return group.items.length === 0 ? (
          <Link
            key={group.id}
            href={group.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground",
              active ? "bg-muted text-foreground" : "text-[var(--color-fg-muted)]",
            )}
          >
            {group.label}
          </Link>
        ) : (
          <AppNavMenu key={group.id} group={group} active={active} />
        );
      })}
    </nav>
  );
}
