import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin");

import { processCadastro } from "@/lib/portal-cadastro";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const mockGetAdmin = vi.mocked(getSupabaseAdmin);
const VALID_USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function makeAdmin({
  afastamentosCount,
  colaboradorExists = false,
  insertError = null,
}: {
  afastamentosCount: number;
  colaboradorExists?: boolean;
  insertError?: { message: string } | null;
}) {
  const mockInsert = vi.fn().mockResolvedValue({ error: insertError });
  mockGetAdmin.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "afastamentos") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: afastamentosCount, error: null }),
          }),
        };
      }
      // colaboradores table
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: colaboradorExists ? { id: VALID_USER_ID } : null,
              error: null,
            }),
          }),
        }),
        insert: mockInsert,
      };
    }),
  } as unknown as ReturnType<typeof getSupabaseAdmin>);
  return { mockInsert };
}

describe("processCadastro", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for non-numeric CPF", async () => {
    const result = await processCadastro(VALID_USER_ID, "1234abc4567");
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/11 dígitos/);
  });

  it("returns 400 for CPF shorter than 11 digits", async () => {
    const result = await processCadastro(VALID_USER_ID, "1234567890");
    expect(result.status).toBe(400);
  });

  it("returns 422 when CPF not found in afastamentos", async () => {
    makeAdmin({ afastamentosCount: 0 });
    const result = await processCadastro(VALID_USER_ID, "99999999999");
    expect(result.status).toBe(422);
    expect(result.error).toMatch(/não encontrado/);
  });

  it("returns 200 and inserts when CPF found", async () => {
    const { mockInsert } = makeAdmin({ afastamentosCount: 2 });
    const result = await processCadastro(VALID_USER_ID, "11111111111");
    expect(result.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith({ id: VALID_USER_ID, cpf: "11111111111" });
  });

  it("returns 200 without inserting when already registered (idempotent)", async () => {
    const { mockInsert } = makeAdmin({ afastamentosCount: 1, colaboradorExists: true });
    const result = await processCadastro(VALID_USER_ID, "11111111111");
    expect(result.status).toBe(200);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 500 when insert fails", async () => {
    makeAdmin({ afastamentosCount: 1, insertError: { message: "unique constraint violated" } });
    const result = await processCadastro(VALID_USER_ID, "11111111111");
    expect(result.status).toBe(500);
    expect(result.error).toBe("unique constraint violated");
  });
});
