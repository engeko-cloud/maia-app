import { describe, expect, it } from "vitest";
import { buildFilterHref, parseFilterParams } from "@/lib/filter-rail";

describe("parseFilterParams", () => {
  it("extracts q and status as strings", () => {
    expect(parseFilterParams({ q: "joao", status: "pendente" })).toEqual({ q: "joao", status: "pendente" });
  });
  it("returns empty values when absent", () => {
    expect(parseFilterParams({})).toEqual({ q: "", status: "" });
  });
  it("ignores array values (URL repeated keys)", () => {
    expect(parseFilterParams({ q: ["a", "b"], status: undefined })).toEqual({ q: "", status: "" });
  });
});

describe("buildFilterHref", () => {
  it("merges patch into existing params", () => {
    expect(buildFilterHref("/afastamentos", { q: "joao" }, { status: "pendente" }))
      .toBe("/afastamentos?q=joao&status=pendente");
  });
  it("clears a param when patch value is empty string", () => {
    expect(buildFilterHref("/afastamentos", { q: "joao", status: "pendente" }, { status: "" }))
      .toBe("/afastamentos?q=joao");
  });
  it("returns the bare path when all params are empty", () => {
    expect(buildFilterHref("/afastamentos", { status: "pendente" }, { status: "" }))
      .toBe("/afastamentos");
  });
});
