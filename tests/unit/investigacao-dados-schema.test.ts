import { describe, expect, it } from "vitest";
import { InvestigacaoDadosSchema, assertFinalizable, sanitizeInvestigacaoDados } from "@/lib/investigacao-dados";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

const UUID_A = "00000000-0000-0000-0000-000000000001";
const UUID_B = "00000000-0000-0000-0000-000000000002";

describe("InvestigacaoDadosSchema", () => {
  it("accepts a fully populated dados", () => {
    const result = InvestigacaoDadosSchema.safeParse({
      ishikawa: [
        { categoria_id: UUID_A, grau_id: UUID_B, causas: [{ descricao: "falta de treino" }] },
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
      ishikawa: [{ categoria_id: "not-a-uuid", grau_id: null, causas: [{ descricao: "x" }] }],
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

  it("aceita causa_id opcional referenciando biblioteca", () => {
    const dados = {
      ishikawa: [{
        categoria_id: VALID_UUID,
        grau_id: VALID_UUID,
        causas: [{ causa_id: VALID_UUID, descricao: "Falta de procedimento" }],
      }],
      plano_acao: [],
      participantes: [],
      fotos: [],
    };
    expect(InvestigacaoDadosSchema.safeParse(dados).success).toBe(true);
  });

  it("aceita causa sem causa_id (free-text)", () => {
    const dados = {
      ishikawa: [{
        categoria_id: VALID_UUID,
        grau_id: VALID_UUID,
        causas: [{ descricao: "Causa personalizada" }],
      }],
      plano_acao: [],
      participantes: [],
      fotos: [],
    };
    expect(InvestigacaoDadosSchema.safeParse(dados).success).toBe(true);
  });

  it("rejeita causa_id mal formado", () => {
    const dados = {
      ishikawa: [{
        categoria_id: VALID_UUID,
        grau_id: VALID_UUID,
        causas: [{ causa_id: "not-a-uuid", descricao: "x" }],
      }],
      plano_acao: [],
      participantes: [],
      fotos: [],
    };
    expect(InvestigacaoDadosSchema.safeParse(dados).success).toBe(false);
  });
});

describe("sanitizeInvestigacaoDados", () => {
  it("drops causas with empty descricao and branches with no causas", () => {
    const cleaned = sanitizeInvestigacaoDados({
      ishikawa: [
        { categoria_id: UUID_A, grau_id: null, causas: [{ descricao: "" }, { descricao: " " }] },
        { categoria_id: UUID_B, grau_id: null, causas: [{ descricao: "real" }, { descricao: "" }] },
      ],
      plano_acao: [], participantes: [], fotos: [],
    });
    expect(cleaned.ishikawa).toHaveLength(1);
    expect(cleaned.ishikawa[0]?.categoria_id).toBe(UUID_B);
    expect(cleaned.ishikawa[0]?.causas).toHaveLength(1);
    expect(cleaned.ishikawa[0]?.causas[0]?.descricao).toBe("real");
  });

  it("preserves other top-level fields untouched", () => {
    const input = {
      ishikawa: [],
      plano_acao: [{ acao: "a", responsavel: "r", prazo: "2026-06-30", status: "pendente" as const }],
      participantes: [{ nome: "M", email: null }],
      fotos:        [{ path: "p", legenda: null }],
    };
    const cleaned = sanitizeInvestigacaoDados(input);
    expect(cleaned.plano_acao).toEqual(input.plano_acao);
    expect(cleaned.participantes).toEqual(input.participantes);
    expect(cleaned.fotos).toEqual(input.fotos);
  });
});

describe("assertFinalizable", () => {
  const valid = {
    ishikawa: [{ categoria_id: UUID_A, grau_id: null, causas: [{ descricao: "c" }] }],
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
