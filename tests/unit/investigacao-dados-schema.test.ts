import { describe, expect, it } from "vitest";
import { InvestigacaoDadosSchema, assertFinalizable } from "@/lib/investigacao-dados";

const UUID_A = "00000000-0000-0000-0000-000000000001";
const UUID_B = "00000000-0000-0000-0000-000000000002";

describe("InvestigacaoDadosSchema", () => {
  it("accepts a fully populated dados", () => {
    const result = InvestigacaoDadosSchema.safeParse({
      ishikawa: [
        { categoria_id: UUID_A, grau_id: UUID_B, causas: ["falta de treino"] },
      ],
      plano_acao: [
        { acao: "treinar equipe", responsavel: "João", prazo: "2026-06-30", status: "pendente" },
      ],
      participantes: [{ nome: "Maria", email: "maria@x.com" }],
      fotos: [{ path: "investigacoes/abc/123.jpg", legenda: "máquina" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty arrays (draft state)", () => {
    const result = InvestigacaoDadosSchema.safeParse({
      ishikawa: [], plano_acao: [], participantes: [], fotos: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-uuid categoria_id", () => {
    const result = InvestigacaoDadosSchema.safeParse({
      ishikawa: [{ categoria_id: "not-a-uuid", grau_id: null, causas: ["x"] }],
      plano_acao: [], participantes: [], fotos: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-iso prazo", () => {
    const result = InvestigacaoDadosSchema.safeParse({
      ishikawa: [],
      plano_acao: [{ acao: "x", responsavel: "y", prazo: "30/06/2026", status: "pendente" }],
      participantes: [], fotos: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid plano_acao status", () => {
    const result = InvestigacaoDadosSchema.safeParse({
      ishikawa: [],
      plano_acao: [{ acao: "x", responsavel: "y", prazo: "2026-06-30", status: "feito" as never }],
      participantes: [], fotos: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty causas in an ishikawa entry", () => {
    const result = InvestigacaoDadosSchema.safeParse({
      ishikawa: [{ categoria_id: UUID_A, grau_id: null, causas: [] }],
      plano_acao: [], participantes: [], fotos: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("assertFinalizable", () => {
  const valid = {
    ishikawa: [{ categoria_id: UUID_A, grau_id: null, causas: ["c"] }],
    plano_acao: [{ acao: "a", responsavel: "r", prazo: "2026-06-30", status: "pendente" as const }],
    participantes: [], fotos: [],
  };

  it("passes for valid finalize payload", () => {
    expect(() => assertFinalizable(valid)).not.toThrow();
  });

  it("throws if no ishikawa", () => {
    expect(() => assertFinalizable({ ...valid, ishikawa: [] })).toThrow(/ishikawa/);
  });

  it("throws if no plano_acao", () => {
    expect(() => assertFinalizable({ ...valid, plano_acao: [] })).toThrow(/plano/);
  });
});
