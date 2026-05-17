export function calcDataFim(dataInicio: string, duracao: number): string {
  const d = new Date(dataInicio + "T00:00:00");
  d.setDate(d.getDate() + duracao - 1);
  return d.toISOString().slice(0, 10);
}
