import { describe, expect, it, vi } from "vitest";
import { resolveSafetyRecipients } from "@/lib/safety-notify";

function fakeAdmin(rows: { safety: Array<{ email: string }>; admins: Array<{ email: string }> }) {
  return {
    from: (table: string) => {
      if (table === "usuarios") {
        return {
          select: () => ({
            eq: (col: string, val: string) => ({
              eq: () => ({
                in: () => ({ data: rows.safety.length ? rows.safety : null, error: null }),
              }),
              data: col === "administrador" && val === "true" ? rows.admins : null,
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("resolveSafetyRecipients", () => {
  it("returns active safety equipe members when present", async () => {
    const admin = {
      rpc: async () => ({ data: null, error: null }),
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              data: [{ email: "a@x.com" }, { email: "b@x.com" }],
              error: null,
            }),
          }),
        }),
      }),
    };
    // Use the explicit two-query implementation:
    vi.spyOn(admin, "from");
    const out = await resolveSafetyRecipients(
      // We pass in a minimal mock instead of an actual client.
      {
        getSafetyEmails: async () => ["a@x.com", "b@x.com", "a@x.com"],
        getAdminEmails: async () => ["fallback@x.com"],
      },
    );
    expect(out.sort()).toEqual(["a@x.com", "b@x.com"]);
  });

  it("falls back to admins when safety equipe is empty", async () => {
    const out = await resolveSafetyRecipients({
      getSafetyEmails: async () => [],
      getAdminEmails:  async () => ["admin@x.com", "admin2@x.com"],
    });
    expect(out.sort()).toEqual(["admin2@x.com", "admin@x.com"]);
  });

  it("dedupes admin fallback", async () => {
    const out = await resolveSafetyRecipients({
      getSafetyEmails: async () => [],
      getAdminEmails:  async () => ["admin@x.com", "admin@x.com"],
    });
    expect(out).toEqual(["admin@x.com"]);
  });

  it("returns empty when neither source has rows", async () => {
    const out = await resolveSafetyRecipients({
      getSafetyEmails: async () => [],
      getAdminEmails:  async () => [],
    });
    expect(out).toEqual([]);
  });
});
