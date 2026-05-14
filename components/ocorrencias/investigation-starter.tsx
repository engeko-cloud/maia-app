import Link from "next/link";
import { ArrowRightIcon, SearchIcon } from "lucide-react";

interface InvestigationStarterProps {
  ocorrenciaId: string;
  hasInvestigation: boolean;
}

export function InvestigationStarter({ ocorrenciaId, hasInvestigation }: InvestigationStarterProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-info-soft)] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-md bg-white text-[var(--color-info)]">
          <SearchIcon className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col">
          <p className="text-sm font-semibold text-foreground">
            {hasInvestigation ? "Investigação em andamento" : "Investigação ainda não iniciada"}
          </p>
          <p className="text-xs text-[var(--color-fg-muted)]">
            {hasInvestigation ? "Continue preenchendo as etapas para concluir." : "Abra a investigação para registrar contexto, causas e ações corretivas."}
          </p>
        </div>
      </div>
      <Link
        href={`/ocorrencias/${ocorrenciaId}/investigacao`}
        className="inline-flex items-center gap-1 rounded-md bg-[var(--color-info)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        {hasInvestigation ? "Continuar investigação" : "Iniciar investigação"}
        <ArrowRightIcon className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
