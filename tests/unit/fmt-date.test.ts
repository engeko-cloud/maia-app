import { describe, it, expect } from "vitest";
import { fmtDate, fmtDateTime } from "@/lib/fmt-date";

describe("fmtDate", () => {
  it("converts YYYY-MM-DD to DD/MM/YYYY", () => {
    expect(fmtDate("2024-01-15")).toBe("15/01/2024");
  });
  it("strips time part when present", () => {
    expect(fmtDate("2024-03-07T14:30:00")).toBe("07/03/2024");
  });
  it("pads single-digit month and day", () => {
    expect(fmtDate("2024-03-05")).toBe("05/03/2024");
  });
  it("returns — for null", () => {
    expect(fmtDate(null)).toBe("—");
  });
  it("returns — for undefined", () => {
    expect(fmtDate(undefined)).toBe("—");
  });
});

describe("fmtDateTime", () => {
  it("formats ISO datetime to DD/MM/YYYY HH:MM", () => {
    expect(fmtDateTime("2024-01-15T09:30:00")).toBe("15/01/2024 09:30");
  });
  it("uses fallbackTime for date-only strings", () => {
    expect(fmtDateTime("2024-01-15", "00:00")).toBe("15/01/2024 00:00");
  });
  it("defaults fallbackTime to 00:00 if omitted", () => {
    expect(fmtDateTime("2024-01-15")).toBe("15/01/2024 00:00");
  });
});
