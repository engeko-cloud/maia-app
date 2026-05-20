/** Subset of AfastamentoRow needed to compute the colaborador's active status
 *  on the portal painel. Kept loose so callers can pass richer rows. */
export interface PortalAfastamentoRow {
  situacao: string;
  data_inicio: string;
  data_fim: string | null;
}

/** Returns the first afastamento that should mark the worker as "Afastado":
 *  - situacao "finalizado" (approved + stored — see lib/afastamento-state.ts)
 *  - data_fim null (single-day declarações) OR data_fim >= today
 *  Future-start scheduled leaves count as ativo, matching user expectation. */
export function findActiveAfastamento<R extends PortalAfastamentoRow>(
  rows: R[] | null | undefined,
  todayIso: string,
): R | undefined {
  return rows?.find(
    (r) => r.situacao === "finalizado" && (r.data_fim == null || r.data_fim >= todayIso),
  );
}
