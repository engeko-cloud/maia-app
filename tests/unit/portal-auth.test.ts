import { describe, expect, it, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server");

import { requireColaborador } from "@/lib/portal-auth";
import { getSupabaseServer } from "@/lib/supabase/server";

const mockGetSupabaseServer = vi.mocked(getSupabaseServer);

const FAKE_USER = { id: "user-123" } as User;

function makeClient({
  user,
  colaboradorCpf,
}: {
  user: User | null;
  colaboradorCpf: string | null;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: colaboradorCpf ? { cpf: colaboradorCpf } : null,
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as Awaited<ReturnType<typeof getSupabaseServer>>;
}

describe("requireColaborador", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns unauthenticated when no session", async () => {
    mockGetSupabaseServer.mockResolvedValue(makeClient({ user: null, colaboradorCpf: null }));
    const result = await requireColaborador();
    expect(result.status).toBe("unauthenticated");
  });

  it("returns no_profile when session exists but no colaboradores row", async () => {
    mockGetSupabaseServer.mockResolvedValue(makeClient({ user: FAKE_USER, colaboradorCpf: null }));
    const result = await requireColaborador();
    expect(result.status).toBe("no_profile");
    if (result.status === "no_profile") {
      expect(result.user.id).toBe("user-123");
    }
  });

  it("returns ok with cpf when colaboradores row exists", async () => {
    mockGetSupabaseServer.mockResolvedValue(
      makeClient({ user: FAKE_USER, colaboradorCpf: "11111111111" }),
    );
    const result = await requireColaborador();
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.cpf).toBe("11111111111");
      expect(result.user.id).toBe("user-123");
    }
  });

  it("queries colaboradores by auth_id (not id)", async () => {
    let capturedEqColumn: unknown;
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: FAKE_USER } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((col: unknown) => {
            capturedEqColumn = col;
            return {
              single: vi.fn().mockResolvedValue({ data: { cpf: "11111111111" }, error: null }),
            };
          }),
        }),
      }),
    } as unknown as Awaited<ReturnType<typeof getSupabaseServer>>;
    mockGetSupabaseServer.mockResolvedValue(client);
    await requireColaborador();
    expect(capturedEqColumn).toBe("auth_id");
  });
});
