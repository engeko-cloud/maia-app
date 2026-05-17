export type StatusTone =
  | "pending"
  | "approved"
  | "rejected"
  | "draft"
  | "success"
  | "new"
  | "investigating";

export type StatusDomain = "afastamento" | "ocorrencia" | "investigacao";

export interface StatusPillSpec {
  tone: StatusTone;
  label: string;
}

const AFASTAMENTO: Record<string, StatusPillSpec> = {
  pendente:   { tone: "pending",  label: "Pendente" },
  rejeitado:  { tone: "rejected", label: "Rejeitado" },
  finalizado: { tone: "success",  label: "Finalizado" },
  cancelado:  { tone: "draft",    label: "Cancelado" },
};

const OCORRENCIA: Record<string, StatusPillSpec> = {
  aberta:           { tone: "new",           label: "Aberta" },
  em_investigacao:  { tone: "investigating", label: "Em investigação" },
  concluida:        { tone: "success",       label: "Concluída" },
};

const INVESTIGACAO: Record<string, StatusPillSpec> = {
  em_andamento: { tone: "new",      label: "Em andamento" },
  em_aprovacao: { tone: "pending",  label: "Aguardando aprovação" },
  aprovada:     { tone: "approved", label: "Aprovada" },
  rejeitada:    { tone: "rejected", label: "Rejeitada" },
  cancelada:    { tone: "draft",    label: "Cancelada" },
};

export function resolveStatusPill(domain: StatusDomain, situacao: string): StatusPillSpec {
  const map =
    domain === "afastamento" ? AFASTAMENTO :
    domain === "ocorrencia"  ? OCORRENCIA  : INVESTIGACAO;
  return map[situacao] ?? { tone: "draft", label: situacao };
}
