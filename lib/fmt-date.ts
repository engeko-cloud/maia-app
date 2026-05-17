function split(iso: string): { y: string; m: string; d: string; time: string } {
  const [datePart, timePart = ""] = iso.includes("T") ? iso.split("T") : [iso, ""];
  const [y, m, d] = datePart.split("-");
  return { y, m, d, time: timePart.slice(0, 5) };
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const { y, m, d } = split(iso);
  return `${m}/${d}/${y}`;
}

export function fmtDateTime(iso: string | null | undefined, fallbackTime = "00:00"): string {
  if (!iso) return "—";
  const { y, m, d, time } = split(iso);
  return `${m}/${d}/${y} ${time || fallbackTime}`;
}
