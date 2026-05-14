export type Greeting = "Bom dia" | "Boa tarde" | "Boa noite";

export function greetingFor(hour: number): Greeting {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}
