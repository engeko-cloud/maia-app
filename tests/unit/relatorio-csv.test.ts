import { describe, it, expect } from "vitest";
import { toCsvRow, toCsvFile } from "@/lib/relatorio/csv";

describe("toCsvRow", () => {
  it("joins plain values with commas", () => {
    expect(toCsvRow(["a", "b", "c"])).toBe("a,b,c");
  });
  it("quotes values containing commas", () => {
    expect(toCsvRow(["hello, world"])).toBe('"hello, world"');
  });
  it("escapes double-quotes by doubling them", () => {
    expect(toCsvRow(['say "hi"'])).toBe('"say ""hi"""');
  });
  it("quotes values containing newlines", () => {
    expect(toCsvRow(["line1\nline2"])).toBe('"line1\nline2"');
  });
  it("passes through plain values unchanged", () => {
    expect(toCsvRow(["Alice", "30", ""])).toBe("Alice,30,");
  });
});

describe("toCsvFile", () => {
  it("returns header row + data rows separated by CRLF", () => {
    const result = toCsvFile(["Name", "Age"], [["Alice", "30"], ["Bob", "25"]]);
    expect(result).toBe("Name,Age\r\nAlice,30\r\nBob,25");
  });
  it("handles empty rows array (headers only)", () => {
    expect(toCsvFile(["A", "B"], [])).toBe("A,B");
  });
  it("joins all rows with CRLF", () => {
    const lines = toCsvFile(["X"], [["1"], ["2"], ["3"]]).split("\r\n");
    expect(lines).toHaveLength(4);
  });
});
