import { describe, expect, it } from "vitest";
import { FAPPTORY_URL, FAPPTORY_LOGO_SRC, FAPPTORY_LOGO_ASPECT } from "@/lib/fapptory";

describe("fapptory constants", () => {
  it("FAPPTORY_URL points to https://fapptory.me", () => {
    expect(FAPPTORY_URL).toBe("https://fapptory.me");
  });

  it("FAPPTORY_LOGO_SRC points to the public asset", () => {
    expect(FAPPTORY_LOGO_SRC).toBe("/fapptory-logo.svg");
  });

  it("FAPPTORY_LOGO_ASPECT is 1561/332", () => {
    expect(FAPPTORY_LOGO_ASPECT).toBeCloseTo(1561 / 332, 5);
  });
});
