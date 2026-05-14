import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

interface PainelHeroProps {
  /** Headline metric, e.g. "3 aprovações aguardando sua revisão." */
  headline: string;
  /** Sub-copy explaining context. */
  sub: string;
  /** Optional CTA. */
  cta?: { href: string; label: string };
}

export function PainelHero({ headline, sub, cta }: PainelHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-xl)] bg-gradient-to-br from-[var(--brand-primary-600)] to-[var(--brand-primary-900)] p-6 text-white sm:p-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at top right, color-mix(in oklab, var(--brand-accent-500) 30%, transparent), transparent 60%)",
        }}
      />
      <div className="relative">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{headline}</h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">{sub}</p>
        {cta && (
          <Link
            href={cta.href}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-accent-500)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand-accent-600)]"
          >
            {cta.label}
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--brand-accent-500)]"
      />
    </section>
  );
}
