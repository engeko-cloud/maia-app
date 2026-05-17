import { describe, expect, it } from "vitest";
import { calcDataFim } from "@/lib/afastamento-date";

describe("calcDataFim", () => {
  it("returns same day when duracao is 1", () => {
    expect(calcDataFim("2026-05-01", 1)).toBe("2026-05-01");
  });

  it("adds duracao - 1 days to data_inicio", () => {
    expect(calcDataFim("2026-05-02", 18)).toBe("2026-05-19");
  });

  it("handles month boundary correctly", () => {
    expect(calcDataFim("2026-01-28", 5)).toBe("2026-02-01");
  });

  it("handles year boundary correctly", () => {
    expect(calcDataFim("2026-12-30", 4)).toBe("2027-01-02");
  });
});
