"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface AppNavMenuItem {
  label: string;
  href: string;
  external?: boolean;
}

interface AppNavMenuGroup {
  id: string;
  label: string;
  items: AppNavMenuItem[];
}

interface AppNavMenuProps {
  group: AppNavMenuGroup;
  /** True when current pathname starts with the group's `href`. */
  active: boolean;
}

export function AppNavMenu({ group, active }: AppNavMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          "text-[var(--color-fg-muted)] hover:bg-muted hover:text-foreground",
          "data-[popup-open]:bg-muted data-[popup-open]:text-foreground",
          active && "text-foreground",
        )}
      >
        {group.label}
        <ChevronDownIcon className="size-4 opacity-60" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="min-w-[200px]">
        {group.items.map((item) =>
          item.external ? (
            <DropdownMenuItem
              key={item.href}
              render={
                <a href={item.href} target="_blank" rel="noreferrer noopener" />
              }
            >
              <span className="flex w-full items-center justify-between gap-2">
                {item.label}
                <ExternalLinkIcon className="size-3.5 opacity-60" aria-hidden="true" />
              </span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={item.href} render={<Link href={item.href} />}>
              {item.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
