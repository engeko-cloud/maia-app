import { describe, expect, it } from "vitest";
import {
  loginSchema,
  forgotPasswordSchema,
  updatePasswordSchema,
} from "@/lib/auth-schemas";

describe("loginSchema", () => {
  it("accepts a valid email + non-empty password", () => {
    const parsed = loginSchema.parse({
      email: "user@example.com",
      password: "anything",
    });
    expect(parsed.email).toBe("user@example.com");
    expect(parsed.password).toBe("anything");
  });

  it("trims whitespace and lowercases the email", () => {
    const parsed = loginSchema.parse({
      email: "  USER@Example.COM ",
      password: "x",
    });
    expect(parsed.email).toBe("user@example.com");
  });

  it("rejects a malformed email with the PT message", () => {
    const r = loginSchema.safeParse({ email: "not-an-email", password: "x" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe("Informe um email válido.");
    }
  });

  it("rejects an empty password with the PT message", () => {
    const r = loginSchema.safeParse({ email: "u@e.com", password: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === "Informe sua senha.")).toBe(true);
    }
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    const parsed = forgotPasswordSchema.parse({ email: "u@e.com" });
    expect(parsed.email).toBe("u@e.com");
  });

  it("rejects a malformed email", () => {
    const r = forgotPasswordSchema.safeParse({ email: "nope" });
    expect(r.success).toBe(false);
  });
});

describe("updatePasswordSchema", () => {
  it("accepts matching passwords of length >= 8", () => {
    const parsed = updatePasswordSchema.parse({
      password: "abcdefgh",
      confirm: "abcdefgh",
    });
    expect(parsed.password).toBe("abcdefgh");
  });

  it("rejects a password shorter than 8 chars", () => {
    const r = updatePasswordSchema.safeParse({ password: "short", confirm: "short" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some(
          (i) =>
            i.path[0] === "password" &&
            i.message === "A senha precisa ter ao menos 8 caracteres.",
        ),
      ).toBe(true);
    }
  });

  it("rejects mismatched confirm with the error on the confirm path", () => {
    const r = updatePasswordSchema.safeParse({
      password: "abcdefgh",
      confirm: "different",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path[0] === "confirm");
      expect(issue?.message).toBe("As senhas não coincidem.");
    }
  });
});
