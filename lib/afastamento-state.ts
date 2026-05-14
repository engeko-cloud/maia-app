// Tipos de situação possíveis para um afastamento
export type Situacao = "pendente" | "rejeitado" | "finalizado" | "cancelado";

// Mapa de transições permitidas: de cada estado, quais destinos são válidos
const ALLOWED: Record<Situacao, Situacao[]> = {
  pendente:   ["finalizado", "rejeitado", "cancelado"],
  rejeitado:  ["pendente",   "cancelado"],
  finalizado: [],   // estado terminal
  cancelado:  [],   // estado terminal
};

// Verifica se a transição de `from` para `to` é permitida pela máquina de estados
export function canTransition(from: Situacao, to: Situacao): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}
