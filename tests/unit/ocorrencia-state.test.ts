import { describe, expect, it } from "vitest";
import { ocorrenciaTipoLabel, OCORRENCIA_SITUACOES } from "@/lib/ocorrencia-state";

describe("ocorrenciaTipoLabel", () => {
  it("maps each enum value to a Portuguese label", () => {
    expect(ocorrenciaTipoLabel("quase_acidente")).toBe("Quase-acidente");
    expect(ocorrenciaTipoLabel("acidente_leve")).toBe("Acidente leve");
    expect(ocorrenciaTipoLabel("acidente_grave")).toBe("Acidente grave");
    expect(ocorrenciaTipoLabel("doenca_ocupacional")).toBe("Doença ocupacional");
    expect(ocorrenciaTipoLabel("outro")).toBe("Outro");
  });
  it("falls back to the raw value for unknown tipos", () => {
    expect(ocorrenciaTipoLabel("misc")).toBe("misc");
  });
});

describe("OCORRENCIA_SITUACOES", () => {
  it("includes the three real situações in order", () => {
    expect(OCORRENCIA_SITUACOES).toEqual(["aberta", "em_investigacao", "concluida"]);
  });
});
