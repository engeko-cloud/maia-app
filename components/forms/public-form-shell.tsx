import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

interface PublicFormShellProps {
  title: string;
  /** Tonal banner copy explaining the form. */
  banner: string;
  /** Top-of-form callout (e.g. rejection motivo). Renders above the form body. */
  callout?: React.ReactNode;
  /** Form body content. */
  children: React.ReactNode;
}

export function PublicFormShell({ title, banner, callout, children }: PublicFormShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[var(--brand-primary-600)] hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Voltar ao portal
      </Link>
      <header className="rounded-md border border-[var(--color-border)] bg-[var(--brand-primary-50)] p-4">
        <h1 className="text-xl font-semibold text-[var(--brand-primary-700)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--brand-primary-700)]/80">{banner}</p>
      </header>
      {callout}
      <div className="rounded-md border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-xs)]">
        {children}
      </div>
    </div>
  );
}
