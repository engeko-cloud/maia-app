export const OCORRENCIA_SITUACOES = ["aberta", "em_investigacao", "concluida"] as const;
export type OcorrenciaSituacao = (typeof OCORRENCIA_SITUACOES)[number];

const TIPO_LABELS: Record<string, string> = {
  acidente:   "Acidente de Trabalho",
  incidente:  "Incidente",
  doenca:     "Doença Ocupacional",
  trajeto:    "Acidente de Trajeto",
  ambiental:  "Ocorrência Ambiental",
};

export function ocorrenciaTipoLabel(tipo: string): string {
  return TIPO_LABELS[tipo] ?? tipo;
}
