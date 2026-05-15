import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  size?: LogoSize;
  /** Hides " · ENGEKO" (used in tight contexts). */
  productOnly?: boolean;
  /** Muted tone (footer). */
  muted?: boolean;
  className?: string;
}

const wordmarkSize: Record<LogoSize, string> = {
  sm: "text-sm",
  md: "text-[15px]",
  lg: "text-lg",
};

export function Logo({
  size = "md",
  productOnly = false,
  muted = false,
  className,
}: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-bold tracking-tight",
        muted ? "text-[var(--color-fg-muted)]" : "text-[var(--brand-primary-600)]",
        wordmarkSize[size],
        className,
      )}
    >
      MAIA
      {!productOnly && (
        <>
          <span
            className={cn(
              "mx-1.5 font-bold",
              muted ? "text-[var(--color-fg-subtle)]" : "text-[var(--brand-accent-500)]",
            )}
            aria-hidden="true"
          >
            ·
          </span>
          <span className={cn(muted && "text-[var(--color-fg-muted)]")}>ENGEKO</span>
        </>
      )}
    </span>
  );
}
