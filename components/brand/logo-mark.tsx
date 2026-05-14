import { cn } from "@/lib/utils";

type LogoMarkSize = "sm" | "md" | "lg";

interface LogoMarkProps {
  size?: LogoMarkSize;
  /** Render as muted-tone (used in footer / secondary contexts). */
  muted?: boolean;
  className?: string;
}

const sizeMap: Record<LogoMarkSize, { box: string; text: string }> = {
  sm: { box: "size-5 rounded-md", text: "text-[9px]" },
  md: { box: "size-7 rounded-lg", text: "text-xs" },
  lg: { box: "size-9 rounded-xl", text: "text-sm" },
};

export function LogoMark({ size = "md", muted = false, className }: LogoMarkProps) {
  const { box, text } = sizeMap[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid place-items-center font-extrabold text-white shrink-0",
        box,
        text,
        muted
          ? "bg-[var(--color-fg-muted)]"
          : "bg-[linear-gradient(135deg,var(--brand-accent-500)_0%,var(--brand-primary-600)_100%)]",
        className,
      )}
    >
      M
    </span>
  );
}
