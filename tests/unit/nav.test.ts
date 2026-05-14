import { describe, expect, it } from "vitest";
import { appNav, type AppNavGroup, type AppNavItem } from "@/lib/nav";

describe("appNav config", () => {
  it("exports the four expected groups in order: painel, afastamentos, ocorrencias, admin", () => {
    expect(appNav.map((g: AppNavGroup) => g.id)).toEqual([
      "painel",
      "afastamentos",
      "ocorrencias",
      "admin",
    ]);
  });

  it("every group has a label and a route", () => {
    for (const group of appNav) {
      expect(group.label.trim().length).toBeGreaterThan(0);
      expect(group.href.startsWith("/")).toBe(true);
    }
  });

  it("groups with submenus have at least one submenu item, others have empty submenu", () => {
    for (const group of appNav) {
      if (group.id === "painel") {
        expect(group.items.length).toBe(0);
      } else {
        expect(group.items.length).toBeGreaterThan(0);
      }
    }
  });

  it("every submenu item has a label and a relative route", () => {
    for (const group of appNav) {
      for (const item of group.items as AppNavItem[]) {
        expect(item.label.trim().length).toBeGreaterThan(0);
        expect(item.href.startsWith("/")).toBe(true);
      }
    }
  });

  it("admin group is flagged adminOnly", () => {
    const admin = appNav.find((g) => g.id === "admin")!;
    expect(admin.adminOnly).toBe(true);
  });

  it("non-admin groups are not adminOnly", () => {
    for (const group of appNav) {
      if (group.id !== "admin") {
        expect(group.adminOnly ?? false).toBe(false);
      }
    }
  });
});
