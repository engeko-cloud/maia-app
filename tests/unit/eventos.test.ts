import { describe, it, expect, vi } from "vitest";
import { writeEvento, type EventoType } from "@/lib/eventos";

describe("writeEvento", () => {
  it("inserts an evento row with required fields", async () => {
    const insert = vi.fn().mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: "ev1" } }) }) });
    const client = { from: vi.fn().mockReturnValue({ insert }) } as any;

    await writeEvento(client, {
      tipoEntidade: "afastamento",
      entidadeId:   "a1",
      evento:       "criado",
      dados:        { x: 1 },
      autorId:      "u1",
    });

    expect(client.from).toHaveBeenCalledWith("eventos");
    expect(insert).toHaveBeenCalledWith({
      tipo_entidade: "afastamento",
      entidade_id:   "a1",
      evento:        "criado",
      dados:         { x: 1 },
      autor_id:      "u1",
    });
  });

  it("defaults dados to {} and autor_id to null", async () => {
    const insert = vi.fn().mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: "ev1" } }) }) });
    const client = { from: vi.fn().mockReturnValue({ insert }) } as any;

    await writeEvento(client, { tipoEntidade: "afastamento", entidadeId: "a1", evento: "aprovado" });

    expect(insert).toHaveBeenCalledWith({
      tipo_entidade: "afastamento",
      entidade_id:   "a1",
      evento:        "aprovado",
      dados:         {},
      autor_id:      null,
    });
  });
});
