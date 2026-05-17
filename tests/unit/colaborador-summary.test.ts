import { describe, expect, it } from "vitest";
import { resolveColaboradorData } from "@/lib/colaborador-summary";

const FALLBACK = {
  nome: "João Fallback",
  cargo: "Analista",
  setor: "TI",
  unidade_nome: "Hospital A",
};

describe("resolveColaboradorData", () => {
  it("uses SOC data when available", () => {
    const soc = {
      cpf: "12345678901",
      nome: "João SOC",
      cargo: "Enfermeiro",
      setor: "UTI",
      codigo_soc: "00123",
      unidade_nome: "Hospital Central",
      unidade_codigo: "HC1",
    };
    const result = resolveColaboradorData(soc, FALLBACK);
    expect(result.nome).toBe("João SOC");
    expect(result.cargo).toBe("Enfermeiro");
    expect(result.setor).toBe("UTI");
    expect(result.unidade_nome).toBe("Hospital Central");
    expect(result.codigo_soc).toBe("00123");
  });

  it("falls back to fallback data when soc is null", () => {
    const result = resolveColaboradorData(null, FALLBACK);
    expect(result.nome).toBe("João Fallback");
    expect(result.cargo).toBe("Analista");
    expect(result.setor).toBe("TI");
    expect(result.unidade_nome).toBe("Hospital A");
    expect(result.codigo_soc).toBeNull();
  });

  it("omits codigo_soc when soc has no codigo_soc", () => {
    const soc = {
      cpf: "12345678901",
      nome: "João SOC",
    };
    const result = resolveColaboradorData(soc, FALLBACK);
    expect(result.codigo_soc).toBeNull();
  });

  it("falls back individual fields from fallback when soc fields are missing", () => {
    const soc = {
      cpf: "12345678901",
      nome: "João SOC",
      // cargo, setor, unidade_nome all missing
    };
    const result = resolveColaboradorData(soc, FALLBACK);
    expect(result.nome).toBe("João SOC");
    expect(result.cargo).toBe("Analista");
    expect(result.setor).toBe("TI");
    expect(result.unidade_nome).toBe("Hospital A");
  });
});
