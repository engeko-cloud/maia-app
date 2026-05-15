import { describe, expect, it } from "vitest";
import { ocorrenciaTipoLabel, OCORRENCIA_SITUACOES } from "@/lib/ocorrencia-state";

describe("ocorrenciaTipoLabel", () => {
  it("maps each enum value to a Portuguese label", () => {
    expect(ocorrenciaTipoLabel("acidente")).toBe("Acidente de Trabalho");
    expect(ocorrenciaTipoLabel("incidente")).toBe("Incidente");
    expect(ocorrenciaTipoLabel("doenca")).toBe("Doença Ocupacional");
    expect(ocorrenciaTipoLabel("trajeto")).toBe("Acidente de Trajeto");
    expect(ocorrenciaTipoLabel("ambiental")).toBe("Ocorrência Ambiental");
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
