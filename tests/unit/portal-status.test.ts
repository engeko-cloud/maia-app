import { describe, expect, it } from "vitest";
import { findActiveAfastamento } from "@/lib/portal-status";

const TODAY = "2026-05-19";

describe("findActiveAfastamento", () => {
  it("treats an approved (finalizado) future-start afastamento as ativo", () => {
    const found = findActiveAfastamento(
      [{ situacao: "finalizado", data_inicio: "2026-05-21", data_fim: "2026-05-28" }],
      TODAY,
    );
    expect(found).toBeDefined();
  });

  it("treats an approved single-day declaração (data_fim null) as ativo on its day", () => {
    const found = findActiveAfastamento(
      [{ situacao: "finalizado", data_inicio: TODAY, data_fim: null }],
      TODAY,
    );
    expect(found).toBeDefined();
  });

  it("treats an approved afastamento ending today as ativo", () => {
    const found = findActiveAfastamento(
      [{ situacao: "finalizado", data_inicio: "2026-05-10", data_fim: TODAY }],
      TODAY,
    );
    expect(found).toBeDefined();
  });

  it("returns undefined for afastamentos whose data_fim has passed", () => {
    const found = findActiveAfastamento(
      [{ situacao: "finalizado", data_inicio: "2026-05-01", data_fim: "2026-05-10" }],
      TODAY,
    );
    expect(found).toBeUndefined();
  });

  it("returns undefined for pending afastamentos", () => {
    const found = findActiveAfastamento(
      [{ situacao: "pendente", data_inicio: TODAY, data_fim: "2026-05-25" }],
      TODAY,
    );
    expect(found).toBeUndefined();
  });

  it("returns undefined for rejected afastamentos", () => {
    const found = findActiveAfastamento(
      [{ situacao: "rejeitado", data_inicio: TODAY, data_fim: "2026-05-25" }],
      TODAY,
    );
    expect(found).toBeUndefined();
  });

  it("returns undefined for null/empty rows", () => {
    expect(findActiveAfastamento(null, TODAY)).toBeUndefined();
    expect(findActiveAfastamento(undefined, TODAY)).toBeUndefined();
    expect(findActiveAfastamento([], TODAY)).toBeUndefined();
  });

  it("returns the first matching row when multiple are active", () => {
    const found = findActiveAfastamento(
      [
        { situacao: "pendente",   data_inicio: TODAY, data_fim: "2026-05-25" },
        { situacao: "finalizado", data_inicio: "2026-05-01", data_fim: "2026-05-15" },
        { situacao: "finalizado", data_inicio: TODAY,        data_fim: "2026-05-25" },
      ],
      TODAY,
    );
    expect(found?.data_inicio).toBe(TODAY);
  });
});
