export interface FilterParams {
  q: string;
  status: string;
}

export function parseFilterParams(
  sp: Record<string, string | string[] | undefined>,
): FilterParams {
  const pick = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : "";
  return { q: pick(sp.q), status: pick(sp.status) };
}

export function buildFilterHref(
  basePath: string,
  current: Partial<FilterParams>,
  patch: Partial<FilterParams>,
): string {
  const merged: Partial<FilterParams> = { ...current, ...patch };
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) usp.set(k, v);
  }
  const qs = usp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
