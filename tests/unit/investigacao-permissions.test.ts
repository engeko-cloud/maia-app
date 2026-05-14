import { describe, expect, it, vi, beforeEach } from "vitest";

const getUserMock      = vi.fn();
const fromMock         = vi.fn();
const getSupabaseServer = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => getSupabaseServer(),
}));

beforeEach(() => {
  getUserMock.mockReset();
  fromMock.mockReset();
  getSupabaseServer.mockReset();
  getSupabaseServer.mockResolvedValue({
    auth: { getUser: getUserMock },
    from: fromMock,
  });
});

function mockUsuariosLookup(profile: { administrador: boolean; equipe_codigos: string[] } | null) {
  fromMock.mockImplementation((table: string) => {
    if (table === "usuarios") {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: profile && {
                administrador: profile.administrador,
                equipe_usuarios: profile.equipe_codigos.map((c) => ({
                  equipes: { codigo: c },
                })),
              },
              error: null,
            }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
}

describe("requireSafetyOrAdmin", () => {
  it("returns null when no user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { requireSafetyOrAdmin } = await import("@/lib/admin-auth");
    expect(await requireSafetyOrAdmin()).toBeNull();
  });

  it("returns the user when admin only", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockUsuariosLookup({ administrador: true, equipe_codigos: [] });
    const { requireSafetyOrAdmin } = await import("@/lib/admin-auth");
    const result = await requireSafetyOrAdmin();
    expect(result?.id).toBe("u1");
  });

  it("returns the user when safety only", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u2" } } });
    mockUsuariosLookup({ administrador: false, equipe_codigos: ["safety"] });
    const { requireSafetyOrAdmin } = await import("@/lib/admin-auth");
    const result = await requireSafetyOrAdmin();
    expect(result?.id).toBe("u2");
  });

  it("returns the user when both admin and safety", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u3" } } });
    mockUsuariosLookup({ administrador: true, equipe_codigos: ["safety"] });
    const { requireSafetyOrAdmin } = await import("@/lib/admin-auth");
    expect((await requireSafetyOrAdmin())?.id).toBe("u3");
  });

  it("returns null for neither admin nor safety", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u4" } } });
    mockUsuariosLookup({ administrador: false, equipe_codigos: ["oh"] });
    const { requireSafetyOrAdmin } = await import("@/lib/admin-auth");
    expect(await requireSafetyOrAdmin()).toBeNull();
  });

  it("returns null when usuarios lookup misses", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u5" } } });
    mockUsuariosLookup(null);
    const { requireSafetyOrAdmin } = await import("@/lib/admin-auth");
    expect(await requireSafetyOrAdmin()).toBeNull();
  });
});
