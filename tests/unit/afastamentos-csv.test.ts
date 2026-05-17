import { describe, it, expect } from "vitest";
import {
  toAfastamentoCsvRows,
  AFASTAMENTO_HEADERS,
  type AfastamentoReportRow,
} from "@/lib/relatorio/afastamentos-csv";

const baseRow: AfastamentoReportRow = {
  serial_id: 42,
  cpf: "12345678901",
  colaborador_nome: "João Silva",
  colaborador_cargo: "Técnico",
  colaborador_setor: "Manutenção",
  data_inicio: "2024-01-15",
  data_fim: "2024-01-20",
  duracao: 5,
  situacao: "aprovado",
  acidente: false,
  inss: true,
  internacao: false,
  cid: "Z99",
  afastamento_tipos: { rotulo: "Médico" },
  empresas: { nome: "Engeko" },
  unidades: { nome: "Matriz" },
};

describe("toAfastamentoCsvRows", () => {
  it("maps fields in the order matching AFASTAMENTO_HEADERS", () => {
    const [row] = toAfastamentoCsvRows([baseRow]);
    expect(row[0]).toBe("42");           // serial_id
    expect(row[1]).toBe("12345678901");  // cpf
    expect(row[2]).toBe("João Silva");   // colaborador_nome
    expect(row[3]).toBe("Técnico");      // cargo
    expect(row[4]).toBe("Manutenção");   // setor
    expect(row[5]).toBe("Engeko");       // empresa
    expect(row[6]).toBe("Matriz");       // unidade
    expect(row[7]).toBe("Médico");       // tipo
    expect(row[8]).toBe("15/01/2024");   // data_inicio
    expect(row[9]).toBe("20/01/2024");   // data_fim
    expect(row[10]).toBe("5");           // duracao
    expect(row[11]).toBe("aprovado");    // situacao
    expect(row[12]).toBe("Não");         // acidente
    expect(row[13]).toBe("Sim");         // inss
    expect(row[14]).toBe("Não");         // internacao
    expect(row[15]).toBe("Z99");         // cid
  });

  it("uses empty string for null fields", () => {
    const row = toAfastamentoCsvRows([{
      ...baseRow,
      colaborador_cargo: null,
      cid: null,
      data_fim: null,
      duracao: null,
    }])[0];
    expect(row[3]).toBe("");
    expect(row[9]).toBe("");
    expect(row[10]).toBe("");
    expect(row[15]).toBe("");
  });

  it("row length equals AFASTAMENTO_HEADERS length", () => {
    const [row] = toAfastamentoCsvRows([baseRow]);
    expect(row).toHaveLength(AFASTAMENTO_HEADERS.length);
  });

  it("returns empty array for empty input", () => {
    expect(toAfastamentoCsvRows([])).toEqual([]);
  });
});
