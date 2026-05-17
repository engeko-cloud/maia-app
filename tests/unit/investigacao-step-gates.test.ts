import { describe, expect, it } from "vitest";
import { STEP_GATES, gatePassesUpTo, assertSubmittable } from "@/lib/investigacao-step-gates";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

const UUID_A = "00000000-0000-0000-0000-000000000001";
const UUID_B = "00000000-0000-0000-0000-000000000002";

const EMPTY: InvestigacaoDados = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] };
const ISHIKAWA_ONLY: InvestigacaoDados = {
  ishikawa: [{ categoria_id: UUID_A, grau_id: UUID_B, causas: [{ descricao: "x" }] }],
  plano_acao: [], participantes: [], fotos: [],
};
const PLANO_AND_ISHIKAWA: InvestigacaoDados = {
  ...ISHIKAWA_ONLY,
  plano_acao: [{ acao: "a", responsavel: "r", prazo: "2026-06-30", status: "pendente" }],
};
const READY: InvestigacaoDados = {
  ...PLANO_AND_ISHIKAWA,
  participantes: [{ nome: "Maria", email: null }],
};

describe("STEP_GATES", () => {
  it("declares the four steps in order", () => {
    expect(STEP_GATES.map((g) => g.step)).toEqual(["ishikawa", "plano_acao", "participantes", "fotos"]);
  });

  it("ishikawa gate requires at least one branch with a cause", () => {
    expect(STEP_GATES[0].min(EMPTY)).toBe(false);
    expect(STEP_GATES[0].min(ISHIKAWA_ONLY)).toBe(true);
  });

  it("plano_acao gate requires at least one item", () => {
    expect(STEP_GATES[1].min(ISHIKAWA_ONLY)).toBe(false);
    expect(STEP_GATES[1].min(PLANO_AND_ISHIKAWA)).toBe(true);
  });

  it("participantes gate requires at least one entry", () => {
    expect(STEP_GATES[2].min(PLANO_AND_ISHIKAWA)).toBe(false);
    expect(STEP_GATES[2].min(READY)).toBe(true);
  });

  it("fotos gate is always satisfied", () => {
    expect(STEP_GATES[3].min(EMPTY)).toBe(true);
  });
});

describe("gatePassesUpTo", () => {
  it("returns true when all gates up to and including target are satisfied", () => {
    expect(gatePassesUpTo(READY, 2)).toBe(true);
  });
  it("returns false when an earlier gate fails", () => {
    expect(gatePassesUpTo(EMPTY, 0)).toBe(false);
    expect(gatePassesUpTo(ISHIKAWA_ONLY, 1)).toBe(false);
  });
});

describe("assertSubmittable", () => {
  it("passes when ishikawa+plano+participantes are populated, fotos optional", () => {
    expect(() => assertSubmittable(READY)).not.toThrow();
  });
  it("throws on missing ishikawa", () => {
    expect(() => assertSubmittable(EMPTY)).toThrow(/ishikawa/i);
  });
  it("throws on missing plano de ação", () => {
    expect(() => assertSubmittable(ISHIKAWA_ONLY)).toThrow(/plano/i);
  });
  it("throws on missing participantes", () => {
    expect(() => assertSubmittable(PLANO_AND_ISHIKAWA)).toThrow(/participante/i);
  });
});
