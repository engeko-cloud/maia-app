import { describe, it, expect } from "vitest";
import { AfastamentoInputSchema } from "@/lib/validation/afastamento";

const base = {
  empresa_id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  unidade_id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
  tipo_id:    "c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f",
  cpf:        "12345678900",
  colaborador_nome: "João Silva",
  data_inicio: "2026-05-13",
  email_remetente: "joao@example.com",
};

describe("AfastamentoInputSchema", () => {
  it("accepts minimal valid payload", () => {
    expect(AfastamentoInputSchema.safeParse(base).success).toBe(true);
  });
  it("rejects malformed CPF", () => {
    expect(AfastamentoInputSchema.safeParse({ ...base, cpf: "abc" }).success).toBe(false);
  });
  it("rejects bad email", () => {
    expect(AfastamentoInputSchema.safeParse({ ...base, email_remetente: "bad" }).success).toBe(false);
  });
  it("accepts emissor jsonb", () => {
    const r = AfastamentoInputSchema.safeParse({
      ...base,
      emissor: { tipo: "CRM", numero: "12345", uf: "SP" },
    });
    expect(r.success).toBe(true);
  });
  it("rejects emissor with bad tipo", () => {
    const r = AfastamentoInputSchema.safeParse({
      ...base,
      emissor: { tipo: "OAB", numero: "1", uf: "SP" },
    });
    expect(r.success).toBe(false);
  });
});
