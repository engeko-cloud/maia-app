import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin");

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const mockGetAdmin = vi.mocked(getSupabaseAdmin);

function makeColaboradoresAdmin(colab: { email: string | null; auth_id: string | null } | null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: colab, error: null }),
        }),
      }),
    }),
  } as unknown as ReturnType<typeof getSupabaseAdmin>;
}

function makeAfastamentosAdmin({ count, error }: { count: number; error?: unknown }) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "colaboradores") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count, error: error ?? null }),
        }),
      };
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
    mockGetAdmin.mockReturnValue(makeColaboradoresAdmin({ email: "ana@engeko.com", auth_id: null }));
    const { POST } = await import("@/app/api/portal/login-init/route");
    const res = await POST(req({ cpf: "11111111111", email: "ana@engeko.com" }) as never);
    expect(res.status).toBe(200);
  });

  it("returns 200 when CPF is in colaboradores with no email stored", async () => {
    mockGetAdmin.mockReturnValue(makeColaboradoresAdmin({ email: null, auth_id: null }));
    const { POST } = await import("@/app/api/portal/login-init/route");
    const res = await POST(req({ cpf: "11111111111", email: "any@email.com" }) as never);
    expect(res.status).toBe(200);
  });

  it("returns 403 when CPF is in colaboradores but email mismatches", async () => {
    mockGetAdmin.mockReturnValue(makeColaboradoresAdmin({ email: "ana@engeko.com", auth_id: null }));
    const { POST } = await import("@/app/api/portal/login-init/route");
    const res = await POST(req({ cpf: "11111111111", email: "wrong@other.com" }) as never);
    expect(res.status).toBe(403);
  });

  it("returns 200 when CPF not in colaboradores but has afastamentos", async () => {
    mockGetAdmin.mockReturnValue(makeAfastamentosAdmin({ count: 3 }));
    const { POST } = await import("@/app/api/portal/login-init/route");
    const res = await POST(req({ cpf: "11111111111", email: "new@worker.com" }) as never);
    expect(res.status).toBe(200);
  });

  it("returns 404 when CPF not in colaboradores and no afastamentos", async () => {
    mockGetAdmin.mockReturnValue(makeAfastamentosAdmin({ count: 0 }));
    const { POST } = await import("@/app/api/portal/login-init/route");
    const res = await POST(req({ cpf: "11111111111", email: "new@worker.com" }) as never);
    expect(res.status).toBe(404);
  });

  it("returns 500 when afastamentos query errors", async () => {
    mockGetAdmin.mockReturnValue(makeAfastamentosAdmin({ count: 0, error: { message: "db error" } }));
    const { POST } = await import("@/app/api/portal/login-init/route");
    const res = await POST(req({ cpf: "11111111111", email: "new@worker.com" }) as never);
    expect(res.status).toBe(500);
  });
});
