import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

interface HeroCta {
  href: string;
  label: string;
}

interface PainelHeroProps {
  headline: string;
  sub: string;
  ctas?: HeroCta[];
}

export function PainelHero({ headline, sub, ctas }: PainelHeroProps) {
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
        {ctas && ctas.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {ctas.map((cta) => (
              <Link
                key={cta.href}
                href={cta.href}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-accent-500)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand-accent-600)]"
              >
                {cta.label}
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
      </div>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--brand-accent-500)]"
      />
    </section>
  );
}
