import { describe, expect, it } from "vitest";
import { buildHref, publicNavSections } from "@/lib/public-nav";

describe("publicNavSections", () => {
  it("exports the three expected sections in order: inicio, formularios, sistemas", () => {
    expect(publicNavSections.map((s) => s.id)).toEqual([
      "inicio",
      "formularios",
      "sistemas",
    ]);
  });

  it("every section has a label and its anchor matches '#<id>'", () => {
    for (const section of publicNavSections) {
      expect(section.label.trim().length).toBeGreaterThan(0);
      expect(section.anchor).toBe(`#${section.id}`);
    }
  });
});

describe("buildHref", () => {
  it("returns the bare anchor when on '/'", () => {
    expect(buildHref("/", "#formularios")).toBe("#formularios");
  });

  it("returns '/<anchor>' when on a non-root public path", () => {
    expect(buildHref("/forms/afastamentos", "#formularios")).toBe("/#formularios");
  });

  it("returns '/<anchor>' for any non-root path including '#inicio'", () => {
    expect(buildHref("/qualquer/coisa", "#inicio")).toBe("/#inicio");
  });
});
