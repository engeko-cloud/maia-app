"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { buildHref, publicNavSections } from "@/lib/public-nav";

interface PublicNavLinksProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
  /** Called after a link is clicked — used by mobile sheet to close itself. */
  onNavigate?: () => void;
}

export function PublicNavLinks({
  orientation = "horizontal",
  className,
  onNavigate,
}: PublicNavLinksProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Seções da página inicial"
      className={cn(
        orientation === "horizontal"
          ? "flex items-center gap-1 text-sm"
          : "flex flex-col gap-1 text-base",
        className,
      )}
    >
      {publicNavSections.map((section) => (
        <Link
          key={section.id}
          href={buildHref(pathname, section.anchor)}
          onClick={onNavigate}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium text-[var(--color-fg-muted)] transition-colors",
            "hover:bg-muted hover:text-foreground",
            orientation === "vertical" && "py-2",
          )}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
