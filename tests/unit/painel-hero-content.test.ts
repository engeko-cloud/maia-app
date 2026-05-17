import { describe, expect, it } from "vitest";
import { buildHeroContent } from "@/lib/painel-hero-content";

describe("buildHeroContent", () => {
  // ── admin ──────────────────────────────────────────────────────────────
  describe("admin (both pendentes and investigacoesPendentes > 0)", () => {
    it("shows combined headline with two CTAs", () => {
      const result = buildHeroContent({
        isAdmin: true, showOh: true, showSafety: true,
        pendentes: 3, investigacoesPendentes: 2,
      });
      expect(result.headline).toBe("3 aprovações e 2 investigações aguardando revisão.");
      expect(result.ctas).toHaveLength(2);
      expect(result.ctas[0].href).toBe("/app/afastamentos/aprovacoes");
      expect(result.ctas[1].href).toBe("/app/investigacoes");
    });

    it("uses singular 'aprovação' when pendentes === 1", () => {
      const result = buildHeroContent({
        isAdmin: true, showOh: true, showSafety: true,
        pendentes: 1, investigacoesPendentes: 2,
      });
      expect(result.headline).toContain("1 aprovação");
    });

    it("uses singular 'investigação' when investigacoesPendentes === 1", () => {
      const result = buildHeroContent({
        isAdmin: true, showOh: true, showSafety: true,
        pendentes: 2, investigacoesPendentes: 1,
      });
      expect(result.headline).toContain("1 investigação");
    });
  });

  describe("admin (only pendentes > 0)", () => {
    it("shows OH headline with one CTA", () => {
      const result = buildHeroContent({
        isAdmin: true, showOh: true, showSafety: true,
        pendentes: 3, investigacoesPendentes: 0,
      });
      expect(result.headline).toBe("3 aprovações aguardando sua revisão.");
      expect(result.ctas).toHaveLength(1);
      expect(result.ctas[0].href).toBe("/app/afastamentos/aprovacoes");
    });
  });

  describe("admin (only investigacoesPendentes > 0)", () => {
    it("shows safety headline with one CTA", () => {
      const result = buildHeroContent({
        isAdmin: true, showOh: true, showSafety: true,
        pendentes: 0, investigacoesPendentes: 4,
      });
      expect(result.headline).toBe("4 investigações aguardando conclusão.");
      expect(result.ctas).toHaveLength(1);
      expect(result.ctas[0].href).toBe("/app/investigacoes");
    });
  });

  describe("admin (all clear)", () => {
    it("shows all-clear headline with no CTAs", () => {
      const result = buildHeroContent({
        isAdmin: true, showOh: true, showSafety: true,
        pendentes: 0, investigacoesPendentes: 0,
      });
      expect(result.headline).toBe("Nada pendente — tudo em dia.");
      expect(result.ctas).toHaveLength(0);
    });
  });

  // ── OH only ────────────────────────────────────────────────────────────
  describe("OH-only user (pendentes > 0)", () => {
    it("shows OH headline with aprovações CTA", () => {
      const result = buildHeroContent({
        isAdmin: false, showOh: true, showSafety: false,
        pendentes: 2, investigacoesPendentes: 0,
      });
      expect(result.headline).toBe("2 aprovações aguardando sua revisão.");
      expect(result.ctas).toHaveLength(1);
      expect(result.ctas[0].href).toBe("/app/afastamentos/aprovacoes");
    });
  });

  describe("OH-only user (all clear)", () => {
    it("shows all-clear headline", () => {
      const result = buildHeroContent({
        isAdmin: false, showOh: true, showSafety: false,
        pendentes: 0, investigacoesPendentes: 0,
      });
      expect(result.headline).toBe("Nada pendente — tudo em dia.");
      expect(result.ctas).toHaveLength(0);
    });
  });

  // ── Safety only ────────────────────────────────────────────────────────
  describe("safety-only user (investigacoesPendentes > 0)", () => {
    it("shows safety headline with investigações CTA", () => {
      const result = buildHeroContent({
        isAdmin: false, showOh: false, showSafety: true,
        pendentes: 0, investigacoesPendentes: 3,
      });
      expect(result.headline).toBe("3 investigações aguardando conclusão.");
      expect(result.ctas).toHaveLength(1);
      expect(result.ctas[0].href).toBe("/app/investigacoes");
    });
  });

  describe("safety-only user (all clear)", () => {
    it("shows all-clear headline", () => {
      const result = buildHeroContent({
        isAdmin: false, showOh: false, showSafety: true,
        pendentes: 0, investigacoesPendentes: 0,
      });
      expect(result.headline).toBe("Nada pendente — tudo em dia.");
      expect(result.ctas).toHaveLength(0);
    });
  });
});
