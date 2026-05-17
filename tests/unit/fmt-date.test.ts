import { describe, it, expect } from "vitest";
import { fmtDate, fmtDateTime } from "@/lib/fmt-date";

describe("fmtDate", () => {
  it("converts YYYY-MM-DD to MM/DD/YYYY", () => {
    expect(fmtDate("2024-01-15")).toBe("01/15/2024");
  });
  it("strips time part when present", () => {
    expect(fmtDate("2024-03-07T14:30:00")).toBe("03/07/2024");
  });
  it("pads single-digit month and day", () => {
    expect(fmtDate("2024-03-05")).toBe("03/05/2024");
  });
  it("returns — for null", () => {
    expect(fmtDate(null)).toBe("—");
  });
  it("returns — for undefined", () => {
    expect(fmtDate(undefined)).toBe("—");
  });
});

describe("fmtDateTime", () => {
  it("formats ISO datetime to MM/DD/YYYY HH:MM", () => {
    expect(fmtDateTime("2024-01-15T09:30:00")).toBe("01/15/2024 09:30");
  });
  it("uses fallbackTime for date-only strings", () => {
    expect(fmtDateTime("2024-01-15", "00:00")).toBe("01/15/2024 00:00");
  });
  it("defaults fallbackTime to 00:00 if omitted", () => {
    expect(fmtDateTime("2024-01-15")).toBe("01/15/2024 00:00");
  });
});
