import { describe, it, expect } from "vitest";
import { nullIfEmpty, transformRow } from "@/scripts/migrate-afastamentos";
import type { LegacyAfastamento, LookupMaps } from "@/scripts/migrate-afastamentos";

const MAPS: LookupMaps = {
  tipoMap:    new Map([["doenca", "tipo-uuid-1"], ["realizacao_exames", "tipo-uuid-2"]]),
  empresaMap: new Map([["1", "emp-uuid-1"], ["2", "emp-uuid-2"]]),
  unidadeMap: new Map([[3, "uni-uuid-3"], [24, "uni-uuid-24"]]),
  userMap:    new Map([["df81a0ec-a65d-4fb5-a5fc-2039c2a94f94", "new-user-uuid-1"]]),
};

const BASE_ROW: LegacyAfastamento = {
  id: 17217,
  status: "aprovado",
  tipo: "doenca",
  org_id: "ec450219-2c84-49dd-902e-e65fcf14aaac",
  empresa_id: 1,
  unidade_id: 3,
  setor: null,
  cargo: null,
  pessoa_id: null,
  cpf: "47376705880",
  data_inicio: "2026-05-30",
  hora_inicio: "",
  data_fim: "2026-05-30",
  hora_fim: "",
  duracao: "1",
  cid: "H10",
  arquivo_url: "https://zgdemniuryzfohgxdafu.supabase.co/storage/v1/object/public/uploads/forms/afastamentos/2026-05-07-abc",
  responsavel: "alexandre.cavalheiro@engeko.com.br",
  aprovado_por: "df81a0ec-a65d-4fb5-a5fc-2039c2a94f94",
  aprovado_em: "2026-05-08 18:13:40.835+00",
  criado_em: "2026-05-07 19:34:49.425+00",
  emissor: { no: "88288", uf: "SP", tipo: "CRM" },
  inss: false,
  medico: true,
  acidente: false,
  internacao: false,
  colaborador: null,
};

describe("nullIfEmpty", () => {
  it("returns null for empty string", () => expect(nullIfEmpty("")).toBeNull());
  it("returns null for null",         () => expect(nullIfEmpty(null)).toBeNull());
  it("returns value for non-empty",   () => expect(nullIfEmpty("abc")).toBe("abc"));
});

describe("transformRow", () => {
  it("maps all fields correctly on happy path", () => {
    const result = transformRow(BASE_ROW, MAPS);
    expect(result).not.toBeNull();
    expect(result!.serial_id).toBe(17217);
    expect(result!.situacao).toBe("aprovado");
    expect(result!.tipo_id).toBe("tipo-uuid-1");
    expect(result!.empresa_id).toBe("emp-uuid-1");
    expect(result!.unidade_id).toBe("uni-uuid-3");
    expect(result!.cpf).toBe("47376705880");
    expect(result!.email_remetente).toBe("alexandre.cavalheiro@engeko.com.br");
    expect(result!.decidido_por).toBe("new-user-uuid-1");
    expect(result!.decidido_em).toBe("2026-05-08 18:13:40.835+00");
    expect(result!.criado_em).toBe("2026-05-07 19:34:49.425+00");
    expect(result!.duracao).toBe(1);
    expect(result!.cid).toBe("H10");
    expect(result!.motivo_rejeicao).toBeNull();
    expect(result!.enviado_fluig_em).toBeNull();
  });

  it("coerces empty hora_inicio and hora_fim to null", () => {
    const result = transformRow(BASE_ROW, MAPS);
    expect(result!.hora_inicio).toBeNull();
    expect(result!.hora_fim).toBeNull();
  });

  it("preserves non-empty hora values", () => {
    const result = transformRow({ ...BASE_ROW, hora_inicio: "08:30", hora_fim: "10:00" }, MAPS);
    expect(result!.hora_inicio).toBe("08:30");
    expect(result!.hora_fim).toBe("10:00");
  });

  it("returns null and warns when tipo is unknown", () => {
    const result = transformRow({ ...BASE_ROW, tipo: "unknown_tipo" }, MAPS);
    expect(result).toBeNull();
  });

  it("returns null and warns when empresa_id is unknown", () => {
    const result = transformRow({ ...BASE_ROW, empresa_id: 99 }, MAPS);
    expect(result).toBeNull();
  });

  it("returns null and warns when unidade_id is unknown", () => {
    const result = transformRow({ ...BASE_ROW, unidade_id: 999 }, MAPS);
    expect(result).toBeNull();
  });

  it("sets decidido_por to null when approver not in userMap", () => {
    const result = transformRow({ ...BASE_ROW, aprovado_por: "unknown-uuid" }, MAPS);
    expect(result!.decidido_por).toBeNull();
  });

  it("sets decidido_por to null when aprovado_por is null", () => {
    const result = transformRow({ ...BASE_ROW, aprovado_por: null }, MAPS);
    expect(result!.decidido_por).toBeNull();
  });

  it("maps colaborador fields", () => {
    const result = transformRow({
      ...BASE_ROW,
      colaborador: "João Silva",
      setor: "TI",
      cargo: "Analista",
    }, MAPS);
    expect(result!.colaborador_nome).toBe("João Silva");
    expect(result!.colaborador_setor).toBe("TI");
    expect(result!.colaborador_cargo).toBe("Analista");
  });

  it("defaults boolean fields to false when null", () => {
    const result = transformRow({ ...BASE_ROW, inss: null, acidente: null, internacao: null }, MAPS);
    expect(result!.inss).toBe(false);
    expect(result!.acidente).toBe(false);
    expect(result!.internacao).toBe(false);
  });

  it("coerces empty cid to null", () => {
    const result = transformRow({ ...BASE_ROW, cid: "" }, MAPS);
    expect(result!.cid).toBeNull();
  });

  it("handles null unidade_id by returning null", () => {
    const result = transformRow({ ...BASE_ROW, unidade_id: null }, MAPS);
    expect(result).toBeNull();
  });
});
