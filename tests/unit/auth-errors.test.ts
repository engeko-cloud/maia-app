import { describe, expect, it } from "vitest";
import { translateAuthError } from "@/lib/auth-errors";

describe("translateAuthError", () => {
  it("returns null for null input", () => {
    expect(translateAuthError(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(translateAuthError(undefined)).toBeNull();
  });

  it("translates 'Invalid login credentials'", () => {
    expect(translateAuthError({ message: "Invalid login credentials" })).toBe(
      "Email ou senha incorretos.",
    );
  });

  it("translates 'Email not confirmed'", () => {
    expect(translateAuthError({ message: "Email not confirmed" })).toBe(
      "Confirme seu email antes de entrar.",
    );
  });

  it("translates 'User not found'", () => {
    expect(translateAuthError({ message: "User not found" })).toBe(
      "Não encontramos uma conta com esse email.",
    );
  });

  it("translates 'Auth session missing!'", () => {
    expect(translateAuthError({ message: "Auth session missing!" })).toBe(
      "Sua sessão expirou. Solicite um novo link.",
    );
  });

  it("translates 'Password should be at least 6 characters.'", () => {
    expect(
      translateAuthError({ message: "Password should be at least 6 characters." }),
    ).toBe("A senha precisa ter ao menos 8 caracteres.");
  });

  it("translates 'New password should be different from the old password.'", () => {
    expect(
      translateAuthError({
        message: "New password should be different from the old password.",
      }),
    ).toBe("A nova senha precisa ser diferente da atual.");
  });

  it("returns the generic fallback for unknown messages", () => {
    expect(translateAuthError({ message: "Some random error" })).toBe(
      "Não foi possível concluir. Tente novamente.",
    );
  });
});
