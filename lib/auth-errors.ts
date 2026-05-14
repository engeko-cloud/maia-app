const map: Record<string, string> = {
  "Invalid login credentials": "Email ou senha incorretos.",
  "Email not confirmed": "Confirme seu email antes de entrar.",
  "User not found": "Não encontramos uma conta com esse email.",
  "Auth session missing!": "Sua sessão expirou. Solicite um novo link.",
  "Password should be at least 6 characters.":
    "A senha precisa ter ao menos 8 caracteres.",
  "New password should be different from the old password.":
    "A nova senha precisa ser diferente da atual.",
};

export function translateAuthError(
  error: { message: string } | null | undefined,
): string | null {
  if (!error) return null;
  return map[error.message] ?? "Não foi possível concluir. Tente novamente.";
}
