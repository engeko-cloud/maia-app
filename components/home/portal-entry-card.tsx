import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

export function PortalEntryCard() {
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
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Portal do Colaborador
        </h2>
        <p className="mt-2 max-w-xl text-sm text-white/80">
          Consulte o status dos seus atestados e afastamentos registrados na ENGEKO.
        </p>
        <Link
          href="/portal/login"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-accent-500)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand-accent-600)]"
        >
          Acessar minha área
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--brand-accent-500)]"
      />
    </section>
  );
}
