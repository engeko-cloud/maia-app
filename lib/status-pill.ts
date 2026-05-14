export type StatusTone =
  | "pending"
  | "approved"
  | "rejected"
  | "draft"
  | "success"
  | "new"
  | "investigating";

export type StatusDomain = "afastamento" | "ocorrencia";

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

export function resolveStatusPill(domain: StatusDomain, situacao: string): StatusPillSpec {
  const map = domain === "afastamento" ? AFASTAMENTO : OCORRENCIA;
  return map[situacao] ?? { tone: "draft", label: situacao };
}
