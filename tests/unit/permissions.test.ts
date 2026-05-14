import { describe, it, expect } from "vitest";
import { isAdmin, isInEquipe } from "@/lib/permissions";

const fixture = {
  id: "u1",
  administrador: false,
  equipes: ["oh"],
};

describe("permissions", () => {
  it("isAdmin true when administrador flag set", () => {
    expect(isAdmin({ ...fixture, administrador: true })).toBe(true);
  });
  it("isAdmin false otherwise", () => {
    expect(isAdmin(fixture)).toBe(false);
  });
  it("isInEquipe true when equipe present", () => {
    expect(isInEquipe(fixture, "oh")).toBe(true);
  });
  it("isInEquipe false otherwise", () => {
    expect(isInEquipe(fixture, "safety")).toBe(false);
  });
  it("isInEquipe true if admin even without membership", () => {
    expect(isInEquipe({ ...fixture, administrador: true, equipes: [] }, "oh")).toBe(true);
  });
});
