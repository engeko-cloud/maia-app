import { cn } from "@/lib/utils";
import { LogoMark } from "./logo-mark";

type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  size?: LogoSize;
  /** Hides the "· ENGEKO" qualifier (for tight contexts). */
  productOnly?: boolean;
  /** Render in muted tone (used in footer). */
  muted?: boolean;
  className?: string;
}

const wordmarkSize: Record<LogoSize, string> = {
  sm: "text-sm gap-1.5",
  md: "text-[15px] gap-2",
  lg: "text-lg gap-2.5",
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
      <LogoMark size={size} muted={muted} />
      <span>
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
    </span>
  );
}
