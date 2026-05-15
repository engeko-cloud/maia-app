import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin");

import { createPortalSession, getPortalSession, deletePortalSession } from "@/lib/portal-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const mockAdmin = vi.mocked(getSupabaseAdmin);

function makeAdminClient(overrides: Record<string, unknown> = {}) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const select = vi.fn();
  const del = vi.fn();
  const eqForSelect = vi.fn().mockReturnValue({
    gt: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { cpf: "11111111111" },
        error: null,
      }),
    }),
  });
  const eqForDelete = vi.fn().mockReturnValue({ error: null });

  select.mockReturnValue({ eq: eqForSelect });
  del.mockReturnValue({ eq: eqForDelete });

  return {
    from: vi.fn().mockImplementation((table: string) => ({
      insert,
      select,
      delete: del,
    })),
    ...overrides,
  } as unknown as ReturnType<typeof getSupabaseAdmin>;
}

describe("portal-session", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createPortalSession returns a 64-char hex token", async () => {
    const client = makeAdminClient();
    mockAdmin.mockReturnValue(client);
    const token = await createPortalSession("11111111111");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("getPortalSession returns cpf for a valid token", async () => {
    const client = makeAdminClient();
    mockAdmin.mockReturnValue(client);
    const cpf = await getPortalSession("sometoken");
    expect(cpf).toBe("11111111111");
  });

  it("getPortalSession returns null when no row found", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
    } as unknown as ReturnType<typeof getSupabaseAdmin>;
    mockAdmin.mockReturnValue(client);
    const cpf = await getPortalSession("badtoken");
    expect(cpf).toBeNull();
  });

  it("deletePortalSession calls delete with the token", async () => {
    const eqSpy = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({ eq: eqSpy }),
      }),
    } as unknown as ReturnType<typeof getSupabaseAdmin>;
    mockAdmin.mockReturnValue(client);
    await deletePortalSession("tok123");
    expect(eqSpy).toHaveBeenCalledWith("token", "tok123");
  });
});
