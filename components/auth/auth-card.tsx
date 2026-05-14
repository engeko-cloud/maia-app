import * as React from "react";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";
import { APP_VERSION } from "@/lib/version";

export interface AuthCardPitch {
  /** Heading words; the word at `accentIndex` renders in the brand accent color. */
  headingWords: string[];
  /** Zero-based index into headingWords. */
  accentIndex: number;
  /** Sub-copy below the heading. */
  sub: string;
}

interface AuthCardProps {
  /** Form-column heading ("Entrar", "Recuperar senha", "Nova senha"). */
  title: string;
  /** One-line lead under the title. */
  lead: string;
  /** Brand-panel pitch (right side desktop, top banner mobile). */
  pitch: AuthCardPitch;
  children: React.ReactNode;
}

function PitchHeading({ pitch }: { pitch: AuthCardPitch }) {
  return (
    <h2 className="text-xl font-semibold leading-tight">
      {pitch.headingWords.map((word, i) => (
        <React.Fragment key={i}>
          {i > 0 && " "}
          <span
            className={
              i === pitch.accentIndex ? "text-[var(--brand-accent-500)]" : ""
            }
          >
            {word}
          </span>
        </React.Fragment>
      ))}
    </h2>
  );
}

function BrandStamp({ tone }: { tone: "light" | "dark" }) {
  const wordmarkClass =
    tone === "light"
      ? "text-sm font-semibold tracking-tight text-foreground"
      : "text-sm font-semibold tracking-tight text-white";
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <LogoMark size="sm" />
      <span className={wordmarkClass}>
        MAIA <span className="text-[var(--brand-accent-500)]">·</span> ENGEKO
      </span>
    </Link>
  );
}

export function AuthCard({ title, lead, pitch, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-[720px] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-lg)]">
      <div className="grid grid-cols-1 md:grid-cols-[1.05fr_1fr]">
        {/* Mobile-only brand banner (stacks above the form below md) */}
        <div className="relative flex items-center gap-3 bg-gradient-to-br from-[var(--brand-primary-600)] to-[var(--brand-primary-900)] p-5 md:hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at top right, color-mix(in oklab, var(--brand-accent-500) 30%, transparent), transparent 60%)",
            }}
          />
          <div className="relative">
            <BrandStamp tone="dark" />
          </div>
        </div>

        {/* Form panel (left on desktop, below the banner on mobile) */}
        <div className="p-6 md:p-8">
          <BrandStamp tone="light" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{lead}</p>
          <div className="mt-6">{children}</div>
        </div>

        {/* Brand panel (desktop only — md and up) */}
        <div className="relative hidden flex-col bg-gradient-to-br from-[var(--brand-primary-600)] to-[var(--brand-primary-900)] p-8 text-white md:flex">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at top right, color-mix(in oklab, var(--brand-accent-500) 30%, transparent), transparent 60%)",
            }}
          />
          <div className="relative flex h-full flex-col">
            <PitchHeading pitch={pitch} />
            <div className="mt-3 h-[3px] w-12 bg-[var(--brand-accent-500)]" />
            <p className="mt-4 text-sm text-white/80">{pitch.sub}</p>
            <p className="mt-auto pt-8 text-xs text-white/60">
              v{APP_VERSION}{" "}
              <span className="text-[var(--brand-accent-500)]">·</span> © 2026
              ENGEKO
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
