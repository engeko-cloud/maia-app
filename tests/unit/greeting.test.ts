import { describe, expect, it } from "vitest";
import { greetingFor } from "@/lib/greeting";

describe("greetingFor", () => {
  it("returns 'Bom dia' for hours 0-11", () => {
    expect(greetingFor(0)).toBe("Bom dia");
    expect(greetingFor(5)).toBe("Bom dia");
    expect(greetingFor(11)).toBe("Bom dia");
  });

  it("returns 'Boa tarde' for hours 12-17", () => {
    expect(greetingFor(12)).toBe("Boa tarde");
    expect(greetingFor(15)).toBe("Boa tarde");
    expect(greetingFor(17)).toBe("Boa tarde");
  });

  it("returns 'Boa noite' for hours 18-23", () => {
    expect(greetingFor(18)).toBe("Boa noite");
    expect(greetingFor(20)).toBe("Boa noite");
    expect(greetingFor(23)).toBe("Boa noite");
  });
});
