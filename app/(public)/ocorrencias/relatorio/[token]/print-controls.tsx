"use client";
import { Button } from "@/components/ui/button";

interface Props { tokenPublico: string; }

export function PrintControls({ tokenPublico }: Props) {
  return (
    <div className="mx-auto flex max-w-3xl items-center justify-between px-4 pb-4 print:hidden">
      <a
        href={`/api/public/investigacoes/${tokenPublico}/pdf`}
        className="rounded-md bg-[var(--brand-primary-600)] px-4 py-2 text-sm font-medium text-white"
      >
        Baixar PDF
      </a>
      <Button type="button" variant="secondary" onClick={() => window.print()}>
        Imprimir
      </Button>
    </div>
  );
}
