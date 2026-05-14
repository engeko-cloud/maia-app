import { describe, it, expect } from "vitest";
import { isEditAllowed } from "@/lib/afastamento-state";

describe("isEditAllowed", () => {
  it("allowed only when rejeitado", () => {
    expect(isEditAllowed("rejeitado")).toBe(true);
  });
  it("denied otherwise", () => {
    expect(isEditAllowed("pendente")).toBe(false);
    expect(isEditAllowed("finalizado")).toBe(false);
    expect(isEditAllowed("cancelado")).toBe(false);
  });
});
