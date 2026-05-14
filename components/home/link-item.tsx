import Link from "next/link";
import {
  ChevronRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  SirenIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { PublicLinkItem } from "@/lib/public-links";

const ICON_MAP: Record<string, LucideIcon> = {
  "file-text": FileTextIcon,
  "siren": SirenIcon,
  "external-link": ExternalLinkIcon,
};

interface LinkItemProps {
  item: PublicLinkItem;
}

export function LinkItem({ item }: LinkItemProps) {
  const Icon = ICON_MAP[item.icon] ?? ExternalLinkIcon;
  const isExternal = item.type === "external";

  const inner = (
    <>
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-lg",
          isExternal
            ? "bg-[var(--brand-primary-50)] text-[var(--brand-primary-600)]"
            : "bg-[var(--brand-accent-50)] text-[var(--brand-accent-600)]",
        )}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">{item.title}</span>
          {isExternal && <Badge variant="secondary">externo</Badge>}
        </span>
        <span className="truncate text-sm text-[var(--color-fg-muted)]">
          {item.description}
        </span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-[var(--color-fg-subtle)]">
        {isExternal ? <ExternalLinkIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
      </span>
    </>
  );

  const baseRow =
    "flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-[var(--color-bg-subtle)]";

  return isExternal ? (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={baseRow}
    >
      {inner}
    </a>
  ) : (
    <Link href={item.url} className={baseRow}>
      {inner}
    </Link>
  );
}
