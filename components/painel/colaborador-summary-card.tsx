import { fetchSocColaborador } from "@/lib/soc";
import { resolveColaboradorData, type ColaboradorFallback } from "@/lib/colaborador-summary";

type Props = {
  cpf: string;
  empresaCodigoSoc: string;
  fallback: ColaboradorFallback;
};

export async function ColaboradorSummaryCard({ cpf, empresaCodigoSoc, fallback }: Props) {
  let soc = null;
  try {
    soc = await fetchSocColaborador(empresaCodigoSoc, cpf);
  } catch {
    // SOC unavailable — use fallback silently
  }

  const data = resolveColaboradorData(soc, fallback);

  const cols: { label: string; value: string | null }[] = [
    { label: "Colaborador", value: data.nome },
    { label: "Cargo", value: data.cargo },
    { label: "Setor", value: data.setor },
    { label: "Unidade", value: data.unidade_nome },
    ...(data.codigo_soc ? [{ label: "Matrícula", value: data.codigo_soc }] : []),
  ];

  return (
    <div className="flex divide-x divide-[var(--color-border)] rounded-md border border-[var(--color-border)] bg-white">
      {cols.map((col, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col gap-1 px-5 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            {col.label}
          </span>
          <span
            className={`truncate text-sm font-medium text-[var(--color-fg)] ${i === 0 ? "text-base font-semibold" : ""}`}
          >
            {col.value ?? "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ColaboradorSummaryCardSkeleton() {
  return (
    <div className="flex divide-x divide-[var(--color-border)] rounded-md border border-[var(--color-border)] bg-white">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col gap-2 px-5 py-3">
          <div className="h-2.5 w-12 animate-pulse rounded bg-[var(--color-border)]" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--color-border)]" />
        </div>
      ))}
    </div>
  );
}
