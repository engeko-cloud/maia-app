import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin");

import { autoRegisterColaborador } from "@/lib/portal-register";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const mockGetAdmin = vi.mocked(getSupabaseAdmin);

function makeAdmin(upsertError: unknown) {
  return {
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: upsertError }),
    }),
  } as unknown as ReturnType<typeof getSupabaseAdmin>;
}

describe("autoRegisterColaborador", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok:true when upsert succeeds", async () => {
    mockGetAdmin.mockReturnValue(makeAdmin(null));
    const result = await autoRegisterColaborador("uid-abc", "11111111111", "ana@engeko.com");
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns ok:false with error message when upsert fails", async () => {
    mockGetAdmin.mockReturnValue(makeAdmin({ message: "unique_violation" }));
    const result = await autoRegisterColaborador("uid-abc", "11111111111", "ana@engeko.com");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("unique_violation");
  });

  it("calls upsert with cpf, email, auth_id and onConflict cpf", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    mockGetAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue({ upsert: upsertMock }),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);
    await autoRegisterColaborador("uid-abc", "11111111111", "ana@engeko.com");
    expect(upsertMock).toHaveBeenCalledWith(
      { cpf: "11111111111", email: "ana@engeko.com", auth_id: "uid-abc" },
      { onConflict: "cpf" },
    );
  });
});
