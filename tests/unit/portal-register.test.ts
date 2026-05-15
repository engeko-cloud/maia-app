import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin");

import { autoRegisterColaborador } from "@/lib/portal-register";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const mockGetAdmin = vi.mocked(getSupabaseAdmin);

// Admin where update affects 1 row (pre-registered, auth_id was null)
function makeUpdateHit(updateError: unknown = null) {
  return {
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue({ error: updateError, count: 1 }),
        }),
      }),
    }),
  } as unknown as ReturnType<typeof getSupabaseAdmin>;
}

// Admin where update hits 0 rows, then find returns existing row (already linked)
function makeUpdateMiss_FindHit() {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "colaboradores") {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ error: null, count: 0 }),
            }),
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { auth_id: "existing-uid" }, error: null }),
            }),
          }),
        };
      }
    }),
  } as unknown as ReturnType<typeof getSupabaseAdmin>;
}

// Admin where update hits 0 rows, find returns null, insert succeeds (new worker path)
function makeInsertPath(insertError: unknown = null) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "colaboradores") {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ error: null, count: 0 }),
            }),
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: insertError }),
        };
      }
    }),
  } as unknown as ReturnType<typeof getSupabaseAdmin>;
}

describe("autoRegisterColaborador", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok:true when pre-registered row is linked (update path)", async () => {
    mockGetAdmin.mockReturnValue(makeUpdateHit());
    const result = await autoRegisterColaborador("uid-abc", "11111111111", "ana@engeko.com");
    expect(result.ok).toBe(true);
  });

  it("returns ok:false when update errors", async () => {
    mockGetAdmin.mockReturnValue(makeUpdateHit({ message: "db error" }));
    const result = await autoRegisterColaborador("uid-abc", "11111111111", "ana@engeko.com");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("db error");
  });

  it("returns ok:true when row already has auth_id set (idempotent)", async () => {
    mockGetAdmin.mockReturnValue(makeUpdateMiss_FindHit());
    const result = await autoRegisterColaborador("uid-abc", "11111111111", "ana@engeko.com");
    expect(result.ok).toBe(true);
  });

  it("returns ok:true when CPF has no row and insert succeeds (afastamentos path)", async () => {
    mockGetAdmin.mockReturnValue(makeInsertPath());
    const result = await autoRegisterColaborador("uid-abc", "11111111111", "ana@engeko.com");
    expect(result.ok).toBe(true);
  });

  it("returns ok:false when insert fails", async () => {
    mockGetAdmin.mockReturnValue(makeInsertPath({ message: "insert error" }));
    const result = await autoRegisterColaborador("uid-abc", "11111111111", "ana@engeko.com");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("insert error");
  });
});
