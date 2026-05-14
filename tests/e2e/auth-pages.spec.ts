import { test, expect } from "@playwright/test";

test("/login renders the AuthCard with all expected affordances", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { level: 1, name: "Entrar" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Saúde ocupacional, sem fricção." }),
  ).toBeVisible();

  const email = page.locator('input[type="email"][autocomplete="email"]');
  await expect(email).toBeVisible();

  const password = page.locator('input[type="password"][autocomplete="current-password"]');
  await expect(password).toBeVisible();

  await expect(page.getByRole("link", { name: "Esqueci a senha" })).toHaveAttribute(
    "href",
    "/forgot-password",
  );
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("/forgot-password renders the AuthCard with all expected affordances", async ({ page }) => {
  await page.goto("/forgot-password");

  await expect(page.getByRole("heading", { level: 1, name: "Recuperar senha" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Recupere rápido, volte ao trabalho." }),
  ).toBeVisible();

  await expect(page.locator('input[type="email"][autocomplete="email"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar link de recuperação" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "← Voltar para login" })).toHaveAttribute(
    "href",
    "/login",
  );
});

test("/update-password renders the AuthCard with both password fields", async ({ page }) => {
  await page.goto("/update-password");

  await expect(page.getByRole("heading", { level: 1, name: "Nova senha" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Senhas fortes, dados protegidos." }),
  ).toBeVisible();

  const passwordFields = page.locator(
    'input[type="password"][autocomplete="new-password"]',
  );
  await expect(passwordFields).toHaveCount(2);

  await expect(page.getByRole("button", { name: "Atualizar senha" })).toBeVisible();
});
