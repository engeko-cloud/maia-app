import { describe, expect, it } from "vitest";
import { resolveStatusPill } from "@/lib/status-pill";

describe("resolveStatusPill", () => {
  it("maps afastamento situações", () => {
    expect(resolveStatusPill("afastamento", "pendente")).toEqual({ tone: "pending", label: "Pendente" });
    expect(resolveStatusPill("afastamento", "rejeitado")).toEqual({ tone: "rejected", label: "Rejeitado" });
    expect(resolveStatusPill("afastamento", "finalizado")).toEqual({ tone: "success", label: "Finalizado" });
    expect(resolveStatusPill("afastamento", "cancelado")).toEqual({ tone: "draft", label: "Cancelado" });
  });

  it("maps ocorrência situações", () => {
    expect(resolveStatusPill("ocorrencia", "aberta")).toEqual({ tone: "new", label: "Aberta" });
    expect(resolveStatusPill("ocorrencia", "em_investigacao")).toEqual({ tone: "investigating", label: "Em investigação" });
    expect(resolveStatusPill("ocorrencia", "concluida")).toEqual({ tone: "success", label: "Concluída" });
  });

  it("falls back to draft tone with raw label for unknown situações", () => {
    expect(resolveStatusPill("afastamento", "fubar" as never)).toEqual({ tone: "draft", label: "fubar" });
  });
});

describe("investigacao status pills", () => {
  it("maps em_aprovacao to pending tone", () => {
    expect(resolveStatusPill("investigacao", "em_aprovacao")).toEqual({
      tone: "pending", label: "Aguardando aprovação",
    });
  });
  it("maps aprovada to approved tone", () => {
    expect(resolveStatusPill("investigacao", "aprovada")).toEqual({
      tone: "approved", label: "Aprovada",
    });
  });
  it("maps rejeitada to rejected tone", () => {
    expect(resolveStatusPill("investigacao", "rejeitada")).toEqual({
      tone: "rejected", label: "Rejeitada",
    });
  });
});
