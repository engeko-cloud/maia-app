import { describe, it, expect, vi } from "vitest";
import {
  getEmailsFalhados,
  getFluigFalhados,
  getAprovacaoLatencia,
  getOcorrenciasPorSituacao,
  getAfastosPorTipo,
  getAnexosStatus,
  getThresholdHoras,
  type FailedItem,
  type SaudeMetrics,
} from "@/lib/dashboard/queries";

// Minimal Supabase mock builder
function makeMock(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.not = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: rows[0] ?? null, error: null });
  // default resolve for array queries
  Object.defineProperty(chain, Symbol.asyncIterator, { value: undefined });
  (chain as any).then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
    Promise.resolve({ data: rows, error: null }).then(resolve);
  return { from: vi.fn().mockReturnValue(chain), chain };
}

describe("getThresholdHoras", () => {
  it("returns the aprovacao_lenta_horas value from config", async () => {
    const { from, chain } = makeMock([{ config: { aprovacao_lenta_horas: 48 } }]);
    chain.single = vi.fn().mockResolvedValue({ data: { config: { aprovacao_lenta_horas: 48 } }, error: null });
    const result = await getThresholdHoras({ from } as any);
    expect(result).toBe(48);
  });

  it("defaults to 24 when the row is missing", async () => {
    const { from, chain } = makeMock([]);
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
    const result = await getThresholdHoras({ from } as any);
    expect(result).toBe(24);
  });
});

describe("getEmailsFalhados", () => {
  it("filters eventos where error key is present in dados", async () => {
    const eventos = [
      { entidade_id: "af-1", dados: { error: "timeout", template: "afastamento-approved" } },
      { entidade_id: "af-2", dados: { template: "afastamento-approved" } }, // no error key
    ];
    const { from, chain } = makeMock(eventos);

    // afastamentos lookup mock
    const afastos = [{ id: "af-1", colaborador_nome: "João", afastamento_tipos: { rotulo: "Médico" } }];
    let callCount = 0;
    from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chain; // eventos query
      // afastamentos query
      const c2 = { select: vi.fn().mockReturnThis(), in: vi.fn() };
      c2.in.mockResolvedValue({ data: afastos, error: null });
      return c2;
    });

    const result = await getEmailsFalhados({ from } as any);
    expect(result.count).toBe(1);
    expect(result.items[0]!.id).toBe("af-1");
    expect(result.items[0]!.colaborador_nome).toBe("João");
  });
});

describe("getAprovacaoLatencia", () => {
  it("returns null P50 and P95 when no approved afastamentos", async () => {
    const { from, chain } = makeMock([]);
    const result = await getAprovacaoLatencia({ from } as any);
    expect(result.p50_horas).toBeNull();
    expect(result.p95_horas).toBeNull();
  });

  it("computes P50 and P95 from criado→aprovado diffs", async () => {
    const now = Date.now();
    const aprovados = [
      { entidade_id: "a1", ocorrido_em: new Date(now).toISOString() },
      { entidade_id: "a2", ocorrido_em: new Date(now).toISOString() },
    ];
    const criados = [
      { entidade_id: "a1", ocorrido_em: new Date(now - 2 * 3600000).toISOString() }, // 2h
      { entidade_id: "a2", ocorrido_em: new Date(now - 10 * 3600000).toISOString() }, // 10h
    ];

    let callCount = 0;
    const from = vi.fn().mockImplementation(() => {
      callCount++;
      const rows = callCount === 1 ? aprovados : criados;
      const c = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis() };
      (c as any).then = (res: (v: { data: typeof rows; error: null }) => void) =>
        Promise.resolve({ data: rows, error: null }).then(res);
      return c;
    });

    const result = await getAprovacaoLatencia({ from } as any);
    // sorted diffs: [2, 10]; P50 = index 1 (50th percentile of 2 items), P95 = index 1
    expect(result.p50_horas).toBeCloseTo(2, 0);
    expect(result.p95_horas).toBeCloseTo(10, 0);
  });
});
