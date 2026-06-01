function split(iso: string): { y: string; m: string; d: string; time: string } {
  const [datePart, timePart = ""] = iso.includes("T") ? iso.split("T") : [iso, ""];
  const [y, m, d] = datePart.split("-");
  return { y, m, d, time: timePart.slice(0, 5) };
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const { y, m, d } = split(iso);
  return `${d}/${m}/${y}`;
}

export function fmtDateTime(iso: string | null | undefined, fallbackTime = "00:00"): string {
  if (!iso) return "—";
  const { y, m, d, time } = split(iso);
  return `${d}/${m}/${y} ${time || fallbackTime}`;
}

// Empty for null/missing or for the "all-day" markers (00:00 / 23:59) that
// migration 024 backfills onto medical afastamentos. Otherwise HH:MM.
export function fmtHora(hora: string | null | undefined): string {
  if (!hora) return "";
  const hhmm = hora.slice(0, 5);
  if (hhmm === "00:00" || hhmm === "23:59") return "";
  return hhmm;
}

export function fmtDateWithHora(
  iso: string | null | undefined,
  hora: string | null | undefined,
): string {
  if (!iso) return "—";
  const date = fmtDate(iso);
  const time = fmtHora(hora);
  return time ? `${date} ${time}` : date;
}
