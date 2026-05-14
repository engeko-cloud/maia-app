export const OCORRENCIA_SITUACOES = ["aberta", "em_investigacao", "concluida"] as const;
export type OcorrenciaSituacao = (typeof OCORRENCIA_SITUACOES)[number];

const TIPO_LABELS: Record<string, string> = {
  quase_acidente:      "Quase-acidente",
  acidente_leve:       "Acidente leve",
  acidente_grave:      "Acidente grave",
  doenca_ocupacional:  "Doença ocupacional",
  outro:               "Outro",
};

export function ocorrenciaTipoLabel(tipo: string): string {
  return TIPO_LABELS[tipo] ?? tipo;
}
