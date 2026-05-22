const SEP = ";";

function escapeCsvValue(value: string | null | undefined): string {
  const str = value ?? "";
  if (str.includes(SEP) || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsvRow(values: (string | null | undefined)[]): string {
  return values.map(escapeCsvValue).join(SEP);
}

export function toCsvFile(headers: string[], rows: (string | null | undefined)[][]): string {
  return [headers, ...rows].map(toCsvRow).join("\r\n");
}
