import { describe, expect, it } from "vitest";
import {
  formatEventoVerb,
  formatEntidadeNoun,
  eventoDotTone,
} from "@/lib/eventos-format";

describe("formatEventoVerb", () => {
  it("maps each evento to a PT-BR verb", () => {
    expect(formatEventoVerb("criado")).toBe("criou");
    expect(formatEventoVerb("aprovado")).toBe("aprovou");
    expect(formatEventoVerb("rejeitado")).toBe("rejeitou");
    expect(formatEventoVerb("resubmetido")).toBe("resubmeteu");
    expect(formatEventoVerb("cancelado")).toBe("cancelou");
    expect(formatEventoVerb("editado")).toBe("editou");
    expect(formatEventoVerb("fluig_enviado")).toBe("enviou ao Fluig");
    expect(formatEventoVerb("fluig_erro")).toBe("falhou no Fluig");
    expect(formatEventoVerb("email_enviado")).toBe("enviou email");
  });
});

describe("formatEntidadeNoun", () => {
  it("maps each tipo_entidade to a PT-BR noun", () => {
    expect(formatEntidadeNoun("afastamento")).toBe("afastamento");
    expect(formatEntidadeNoun("ocorrencia")).toBe("ocorrência");
    expect(formatEntidadeNoun("investigacao")).toBe("investigação");
  });
});

describe("eventoDotTone", () => {
  it("returns 'approved' for aprovado", () => {
    expect(eventoDotTone("aprovado")).toBe("approved");
  });
  it("returns 'rejected' for rejeitado and cancelado", () => {
    expect(eventoDotTone("rejeitado")).toBe("rejected");
    expect(eventoDotTone("cancelado")).toBe("rejected");
  });
  it("returns 'new' for criado, resubmetido, and editado", () => {
    expect(eventoDotTone("criado")).toBe("new");
    expect(eventoDotTone("resubmetido")).toBe("new");
    expect(eventoDotTone("editado")).toBe("new");
  });
  it("returns 'muted' for system events", () => {
    expect(eventoDotTone("fluig_enviado")).toBe("muted");
    expect(eventoDotTone("fluig_erro")).toBe("muted");
    expect(eventoDotTone("email_enviado")).toBe("muted");
  });
});
