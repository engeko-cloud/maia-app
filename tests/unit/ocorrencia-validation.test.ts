import { describe, expect, it } from "vitest";
import { OcorrenciaInputSchema } from "@/lib/validation/ocorrencia";

const BASE = {
  empresa_id:      "00000000-0000-4000-8000-000000000001",
  unidade_id:      "00000000-0000-4000-8000-000000000002",
  tipo:            "acidente",
  data_ocorrencia: "2026-05-17",
  email_remetente: "test@example.com",
  descricao:       "Descrição com pelo menos dez caracteres aqui.",
};

describe("OcorrenciaInputSchema — dut validation", () => {
  it("accepts form without vítima and without dut", () => {
    expect(() => OcorrenciaInputSchema.parse(BASE)).not.toThrow();
  });

  it("requires dut when relacao_vitima is set", () => {
    const result = OcorrenciaInputSchema.safeParse({
      ...BASE,
      relacao_vitima: "colaborador",
      // dut omitted
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("dut"))).toBe(true);
    }
  });

  it("accepts form with relacao_vitima and dut", () => {
    expect(() =>
      OcorrenciaInputSchema.parse({
        ...BASE,
        relacao_vitima: "colaborador",
        dut: "2026-05-16",
      })
    ).not.toThrow();
  });
});
