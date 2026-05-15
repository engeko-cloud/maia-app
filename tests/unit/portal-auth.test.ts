import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));
vi.mock("@/lib/portal-session");

import { requirePortalSession } from "@/lib/portal-auth";
import { cookies } from "next/headers";
import { getPortalSession } from "@/lib/portal-session";

const mockCookies = vi.mocked(cookies);
const mockGetPortalSession = vi.mocked(getPortalSession);

function makeCookieStore(token: string | undefined) {
  return { get: vi.fn().mockReturnValue(token ? { value: token } : undefined) } as unknown as Awaited<ReturnType<typeof cookies>>;
}

describe("requirePortalSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no cookie present", async () => {
    mockCookies.mockResolvedValue(makeCookieStore(undefined));
    const result = await requirePortalSession();
    expect(result).toBeNull();
    expect(mockGetPortalSession).not.toHaveBeenCalled();
  });

  it("returns null when session not found in DB", async () => {
    mockCookies.mockResolvedValue(makeCookieStore("sometoken"));
    mockGetPortalSession.mockResolvedValue(null);
    const result = await requirePortalSession();
    expect(result).toBeNull();
  });

  it("returns cpf when valid session found", async () => {
    mockCookies.mockResolvedValue(makeCookieStore("validtoken"));
    mockGetPortalSession.mockResolvedValue("11111111111");
    const result = await requirePortalSession();
    expect(result).toEqual({ cpf: "11111111111" });
  });
});
