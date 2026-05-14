import { describe, it, expect } from "vitest";
import { AfastamentoInputSchema } from "@/lib/validation/afastamento";

const base = {
  empresa_id: "11111111-1111-1111-1111-111111111111",
  unidade_id: "22222222-2222-2222-2222-222222222222",
  tipo_id:    "33333333-3333-3333-3333-333333333333",
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
      emissor: { tipo: "CRM", no: "12345", uf: "SP" },
    });
    expect(r.success).toBe(true);
  });
  it("rejects emissor with bad tipo", () => {
    const r = AfastamentoInputSchema.safeParse({
      ...base,
      emissor: { tipo: "OAB", no: "1", uf: "SP" },
    });
    expect(r.success).toBe(false);
  });
});
