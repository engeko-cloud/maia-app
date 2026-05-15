import { describe, expect, it } from "vitest";
import { FAPPTORY_URL, FAPPTORY_LOGO_SRC } from "@/lib/fapptory";

describe("fapptory constants", () => {
  it("FAPPTORY_URL points to https://fapptory.me", () => {
    expect(FAPPTORY_URL).toBe("https://fapptory.me");
  });

  it("FAPPTORY_LOGO_SRC points to the public asset", () => {
    expect(FAPPTORY_LOGO_SRC).toBe("/fapptory-logo.svg");
  });
});
