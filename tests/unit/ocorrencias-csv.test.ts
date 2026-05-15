import { describe, it, expect } from "vitest";
import {
  toOcorrenciaCsvRows,
  OCORRENCIA_HEADERS,
  type OcorrenciaReportRow,
} from "@/lib/relatorio/ocorrencias-csv";

const baseRow: OcorrenciaReportRow = {
  serial_id: 7,
  cpf: "98765432100",
  colaborador_nome: "Ana Costa",
  colaborador_cargo: "Operadora",
  colaborador_setor: "Produção",
  tipo: "acidente_trabalho",
  data_ocorrencia: "2024-03-10",
  hora_ocorrencia: "14:30",
  situacao: "concluida",
  afastamento: true,
  atendimento: true,
  bo: false,
  internacao: false,
  morte: false,
  cid: "S50",
  empresas: { nome: "Engeko" },
  unidades: { nome: "Filial SP" },
};

describe("toOcorrenciaCsvRows", () => {
  it("maps fields in the order matching OCORRENCIA_HEADERS", () => {
    const [row] = toOcorrenciaCsvRows([baseRow]);
    expect(row[0]).toBe("7");                   // serial_id
    expect(row[1]).toBe("98765432100");          // cpf
    expect(row[2]).toBe("Ana Costa");            // colaborador_nome
    expect(row[3]).toBe("Operadora");            // cargo
    expect(row[4]).toBe("Produção");             // setor
    expect(row[5]).toBe("Engeko");               // empresa
    expect(row[6]).toBe("Filial SP");            // unidade
    expect(row[7]).toBe("acidente_trabalho");    // tipo
    expect(row[8]).toBe("2024-03-10");           // data_ocorrencia
    expect(row[9]).toBe("14:30");                // hora_ocorrencia
    expect(row[10]).toBe("concluida");           // situacao
    expect(row[11]).toBe("Sim");                 // afastamento
    expect(row[12]).toBe("Sim");                 // atendimento
    expect(row[13]).toBe("Não");                 // bo
    expect(row[14]).toBe("Não");                 // internacao
    expect(row[15]).toBe("Não");                 // morte
    expect(row[16]).toBe("S50");                 // cid
  });

  it("uses empty string for null fields", () => {
    const row = toOcorrenciaCsvRows([{
      ...baseRow,
      cpf: null,
      hora_ocorrencia: null,
      cid: null,
    }])[0];
    expect(row[1]).toBe("");
    expect(row[9]).toBe("");
    expect(row[16]).toBe("");
  });

  it("row length equals OCORRENCIA_HEADERS length", () => {
    const [row] = toOcorrenciaCsvRows([baseRow]);
    expect(row).toHaveLength(OCORRENCIA_HEADERS.length);
  });

  it("returns empty array for empty input", () => {
    expect(toOcorrenciaCsvRows([])).toEqual([]);
  });
});
