import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  size?: LogoSize;
  /** Render as white (for dark backgrounds). */
  inverted?: boolean;
  className?: string;
}

const sizeMap: Record<LogoSize, { width: number; height: number }> = {
  sm:  { width: 90,  height: 17 },
  md:  { width: 110, height: 21 },
  lg:  { width: 132, height: 25 },
};

export function Logo({ size = "md", inverted = false, className }: LogoProps) {
  const { width, height } = sizeMap[size];
  return (
    <Image
      src="/engeko-logo.png"
      alt="ENGEKO"
      width={width}
      height={height}
      className={cn(inverted && "brightness-0 invert", className)}
      priority
    />
  );
}
