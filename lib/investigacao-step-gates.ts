import type { InvestigacaoDados } from "@/lib/investigacao-dados";

export type GateStep = "ishikawa" | "plano_acao" | "participantes" | "fotos";

export interface StepGate {
  step: GateStep;
  /** Returns true when the user may advance past this step. */
  min: (dados: InvestigacaoDados) => boolean;
  /** Human message to surface when the gate is not satisfied. */
  message: string;
}

// Per-field completeness of plano_acao items is enforced by InvestigacaoDadosSchema
// (acao.min(1), responsavel.min(1), prazo ISO regex, status enum). Gates only check counts.
export const STEP_GATES: StepGate[] = [
  {
    step: "ishikawa",
    min: (d) => d.ishikawa.some((b) => b.causas.length > 0),
    message: "Adicione ao menos uma causa em qualquer categoria do Ishikawa.",
  },
  {
    step: "plano_acao",
    min: (d) => d.plano_acao.length >= 1,
    message: "Adicione ao menos uma ação ao plano de ação.",
  },
  {
    step: "participantes",
    min: (d) => d.participantes.length >= 1,
    message: "Adicione ao menos um participante.",
  },
  {
    step: "fotos",
    min: () => true,
    message: "",
  },
];

/** True when every gate up to and including stepIndex passes. */
export function gatePassesUpTo(dados: InvestigacaoDados, stepIndex: number): boolean {
  for (let i = 0; i <= stepIndex; i++) {
    if (!STEP_GATES[i].min(dados)) return false;
  }
  return true;
}

/** Throws the first unmet gate message (excluding optional fotos). Used by submit and approve. */
export function assertSubmittable(dados: InvestigacaoDados): void {
  for (const gate of STEP_GATES) {
    if (gate.step === "fotos") continue;
    if (!gate.min(dados)) {
      throw new Error(gate.message);
    }
  }
}
