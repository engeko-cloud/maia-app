function escapeCsvValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsvRow(values: string[]): string {
  return values.map(escapeCsvValue).join(",");
}

export function toCsvFile(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map(toCsvRow).join("\r\n");
}
