import { describe, expect, it } from "vitest";
import { publicLinks, type PublicLinkGroup, type PublicLinkItem } from "@/lib/public-links";

describe("publicLinks config", () => {
  it("exports at least one group", () => {
    expect(publicLinks.length).toBeGreaterThan(0);
  });

  it("every group has a non-empty title and at least one item", () => {
    for (const group of publicLinks as PublicLinkGroup[]) {
      expect(group.title.trim().length).toBeGreaterThan(0);
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it("every item has the required fields with valid types", () => {
    const validTypes: PublicLinkItem["type"][] = ["internal", "external"];
    for (const group of publicLinks) {
      for (const item of group.items) {
        expect(item.title.trim().length).toBeGreaterThan(0);
        expect(item.description.trim().length).toBeGreaterThan(0);
        expect(item.url.trim().length).toBeGreaterThan(0);
        expect(item.icon.trim().length).toBeGreaterThan(0);
        expect(validTypes).toContain(item.type);
      }
    }
  });

  it("internal items use relative URLs and external items use absolute URLs", () => {
    for (const group of publicLinks) {
      for (const item of group.items) {
        if (item.type === "internal") {
          expect(item.url.startsWith("/"), `internal "${item.title}" must start with /`).toBe(true);
        } else {
          expect(/^https?:\/\//.test(item.url), `external "${item.title}" must be http(s)://`).toBe(true);
        }
      }
    }
  });
});
