import { describe, expect, it } from "vitest";
import { buildCategoriaInUseQuery, buildGrauInUseQuery, buildCausaInUseQuery } from "@/lib/investigacao-fk-check";

describe("buildCategoriaInUseQuery", () => {
  it("builds the @> contains predicate for categoria_id", () => {
    const { sql, params } = buildCategoriaInUseQuery("cat-uuid");
    expect(sql).toContain("dados -> 'ishikawa' @>");
    expect(sql).toContain("jsonb_build_array");
    expect(sql).toContain("'categoria_id'");
    expect(params).toEqual(["cat-uuid"]);
  });
});

describe("buildGrauInUseQuery", () => {
  it("builds the @> contains predicate for grau_id", () => {
    const { sql, params } = buildGrauInUseQuery("grau-uuid");
    expect(sql).toContain("dados -> 'ishikawa' @>");
    expect(sql).toContain("'grau_id'");
    expect(params).toEqual(["grau-uuid"]);
  });
});

describe("buildCausaInUseQuery", () => {
  it("builds the @> contains predicate for causa_id", () => {
    const { sql, params } = buildCausaInUseQuery("causa-uuid");
    expect(sql).toContain("dados -> 'ishikawa' @>");
    expect(sql).toContain("'causa_id'");
    expect(params).toEqual(["causa-uuid"]);
  });
});
