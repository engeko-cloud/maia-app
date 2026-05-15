import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  FAPPTORY_URL,
  FAPPTORY_LOGO_SRC,
  FAPPTORY_LOGO_ASPECT,
} from "@/lib/fapptory";

interface FapptoryAttributionProps {
  /** sm = footer line; md = below auth/portal-public cards. */
  size?: "sm" | "md";
  className?: string;
}

const heights: Record<"sm" | "md", number> = { sm: 14, md: 18 };

export function FapptoryAttribution({
  size = "sm",
  className,
}: FapptoryAttributionProps) {
  const height = heights[size];
  const width = Math.round(height * FAPPTORY_LOGO_ASPECT);
  return (
    <a
      href={FAPPTORY_URL}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Feito por Fapptory (abre em nova aba)"
      className={cn(
        "inline-flex items-center gap-1.5 text-[var(--color-fg-muted)] hover:text-foreground",
        size === "md" && "gap-2",
        className,
      )}
    >
      <span className={size === "md" ? "text-sm" : "text-xs"}>Feito por</span>
      <Image
        src={FAPPTORY_LOGO_SRC}
        alt="Fapptory"
        width={width}
        height={height}
        unoptimized
        priority={false}
      />
    </a>
  );
}
