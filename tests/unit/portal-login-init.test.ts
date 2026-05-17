import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin");
vi.mock("@/lib/mail/send", () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
}));

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const mockGetAdmin = vi.mocked(getSupabaseAdmin);

// Full admin mock that handles all tables the route touches
function makeAdmin({
  colab,
  colabError = null,
  afastamentosCount = null,
  afastamentosError = null,
}: {
  colab: { email: string | null } | null;
  colabError?: unknown;
  afastamentosCount?: number | null;
  afastamentosError?: unknown;
}) {
  const eqForDelete2 = vi.fn().mockResolvedValue({ error: null });
  const eqForDelete1 = vi.fn().mockReturnValue({ eq: eqForDelete2 });
  const updateChain = vi.fn().mockReturnValue({ eq: eqForDelete1 });
  const insertResult = vi.fn().mockResolvedValue({ error: null });

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "colaboradores") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: colab, error: colabError ?? null }),
            }),
          }),
        };
      }
      if (table === "afastamentos") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: afastamentosCount, error: afastamentosError ?? null }),
          }),
        };
      }
      if (table === "portal_otp_codes") {
        // Build a fluent chain for .select().eq().eq().eq().gt().order().limit().maybeSingle()
        const otpSelectChain = {} as Record<string, unknown>;
        const fluent = () => otpSelectChain;
        otpSelectChain.eq = fluent;
        otpSelectChain.gt = fluent;
        otpSelectChain.order = fluent;
        otpSelectChain.limit = fluent;
        otpSelectChain.maybeSingle = vi.fn().mockResolvedValue({ data: null });
        return {
          select: vi.fn().mockReturnValue(otpSelectChain),
          update: updateChain,
          insert: insertResult,
        };
      }
      return {};
    }),
  } as unknown as ReturnType<typeof getSupabaseAdmin>;
}

function req(body: unknown) {
  return new Request("http://localhost/api/portal/login-init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/portal/login-init", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid CPF", async () => {
    mockGetAdmin.mockReturnValue({} as ReturnType<typeof getSupabaseAdmin>);
    const { POST } = await import("@/app/api/portal/login-init/route");
    const res = await POST(req({ cpf: "123", email: "a@b.com" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email", async () => {
    mockGetAdmin.mockReturnValue({} as ReturnType<typeof getSupabaseAdmin>);
    const { POST } = await import("@/app/api/portal/login-init/route");
    const res = await POST(req({ cpf: "11111111111", email: "not-an-email" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 200 when CPF is in colaboradores and email matches", async () => {
    mockGetAdmin.mockReturnValue(makeAdmin({ colab: { email: "ana@engeko.com" } }));
    const { POST } = await import("@/app/api/portal/login-init/route");
    const res = await POST(req({ cpf: "11111111111", email: "ana@engeko.com" }) as never);
    expect(res.status).toBe(200);
  });

  it("returns 200 when CPF is in colaboradores with no email stored", async () => {
    mockGetAdmin.mockReturnValue(makeAdmin({ colab: { email: null } }));
    const { POST } = await import("@/app/api/portal/login-init/route");
    const res = await POST(req({ cpf: "11111111111", email: "any@email.com" }) as never);
    expect(res.status).toBe(200);
  });

  it("returns 403 when CPF is in colaboradores but email mismatches", async () => {
    mockGetAdmin.mockReturnValue(makeAdmin({ colab: { email: "ana@engeko.com" } }));
    const { POST } = await import("@/app/api/portal/login-init/route");
    const res = await POST(req({ cpf: "11111111111", email: "wrong@other.com" }) as never);
    expect(res.status).toBe(403);
  });

  it("returns 200 when CPF not in colaboradores but has afastamentos", async () => {
    mockGetAdmin.mockReturnValue(makeAdmin({ colab: null, afastamentosCount: 3 }));
    const { POST } = await import("@/app/api/portal/login-init/route");
    const res = await POST(req({ cpf: "11111111111", email: "new@worker.com" }) as never);
    expect(res.status).toBe(200);
  });

  it("returns 404 when CPF not in colaboradores and no afastamentos", async () => {
    mockGetAdmin.mockReturnValue(makeAdmin({ colab: null, afastamentosCount: 0 }));
    const { POST } = await import("@/app/api/portal/login-init/route");
    const res = await POST(req({ cpf: "11111111111", email: "new@worker.com" }) as never);
    expect(res.status).toBe(404);
  });

  it("returns 500 when afastamentos query errors", async () => {
    mockGetAdmin.mockReturnValue(makeAdmin({ colab: null, afastamentosCount: null, afastamentosError: { message: "db error" } }));
    const { POST } = await import("@/app/api/portal/login-init/route");
    const res = await POST(req({ cpf: "11111111111", email: "new@worker.com" }) as never);
    expect(res.status).toBe(500);
  });
});
