// lib/investigacao-state.ts
export const INVESTIGACAO_SITUACOES = ["em_andamento", "finalizada"] as const;
export type InvestigacaoSituacao = (typeof INVESTIGACAO_SITUACOES)[number];

const SITUACAO_LABELS: Record<InvestigacaoSituacao, string> = {
  em_andamento: "Em andamento",
  finalizada:   "Finalizada",
};

export function investigacaoSituacaoLabel(s: string): string {
  return SITUACAO_LABELS[s as InvestigacaoSituacao] ?? s;
}

export const PLANO_ACAO_STATUS = ["pendente", "em_andamento", "concluida", "cancelada"] as const;
export type PlanoAcaoStatus = (typeof PLANO_ACAO_STATUS)[number];

const PLANO_ACAO_LABELS: Record<PlanoAcaoStatus, string> = {
  pendente:     "Pendente",
  em_andamento: "Em andamento",
  concluida:    "Concluída",
  cancelada:    "Cancelada",
};

export function planoAcaoStatusLabel(s: string): string {
  return PLANO_ACAO_LABELS[s as PlanoAcaoStatus] ?? s;
}
