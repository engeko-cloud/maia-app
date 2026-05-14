import { describe, it, expect } from "vitest";
import { canTransition } from "@/lib/afastamento-state";

describe("canTransition", () => {
  it("pendente → finalizado allowed", () => {
    expect(canTransition("pendente", "finalizado")).toBe(true);
  });
  it("pendente → rejeitado allowed", () => {
    expect(canTransition("pendente", "rejeitado")).toBe(true);
  });
  it("rejeitado → pendente allowed (resubmit)", () => {
    expect(canTransition("rejeitado", "pendente")).toBe(true);
  });
  it("finalizado → anything denied", () => {
    expect(canTransition("finalizado", "rejeitado")).toBe(false);
    expect(canTransition("finalizado", "pendente")).toBe(false);
  });
  it("cancelado → anything denied", () => {
    expect(canTransition("cancelado", "pendente")).toBe(false);
  });
  it("admin-cancel allowed from pendente or rejeitado", () => {
    expect(canTransition("pendente", "cancelado")).toBe(true);
    expect(canTransition("rejeitado", "cancelado")).toBe(true);
  });
});
