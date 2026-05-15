import { describe, expect, it } from "vitest";
import { publicNav, type PublicNavGroup } from "@/lib/public-nav";
import { publicLinks } from "@/lib/public-links";

describe("publicNav", () => {
  it("exports three groups in order: inicio, formularios, sistemas", () => {
    expect(publicNav.map((g: PublicNavGroup) => g.id)).toEqual([
      "inicio",
      "formularios",
      "sistemas",
    ]);
  });

  it("Início is a flat link to '/' with no items", () => {
    const inicio = publicNav.find((g) => g.id === "inicio")!;
    expect(inicio.href).toBe("/");
    expect(inicio.items).toEqual([]);
  });

  it("Formulários dropdown is derived from publicLinks 'Formulários' group", () => {
    const formulariosNav = publicNav.find((g) => g.id === "formularios")!;
    const formulariosSrc = publicLinks.find((g) => g.title === "Formulários")!;
    expect(formulariosNav.items.length).toBe(formulariosSrc.items.length);
    expect(formulariosNav.items.map((i) => i.href)).toEqual(
      formulariosSrc.items.map((i) => i.url),
    );
    for (const item of formulariosNav.items) {
      expect(item.external).toBeFalsy();
    }
  });

  it("Sistemas dropdown is derived from publicLinks 'Sistemas Externos' and marks every item external", () => {
    const sistemasNav = publicNav.find((g) => g.id === "sistemas")!;
    const sistemasSrc = publicLinks.find((g) => g.title === "Sistemas Externos")!;
    expect(sistemasNav.items.length).toBe(sistemasSrc.items.length);
    expect(sistemasNav.items.map((i) => i.href)).toEqual(
      sistemasSrc.items.map((i) => i.url),
    );
    for (const item of sistemasNav.items) {
      expect(item.external).toBe(true);
    }
  });
});
