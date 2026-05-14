import { test, expect } from "@playwright/test";

test("public landing shows linktree groups and Entrar CTA", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Bem-vindo à MAIA|Olá/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Formulários" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sistemas Externos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();

  const nextSvg = page.locator('img[src="/next.svg"]');
  await expect(nextSvg).toHaveCount(0);
});
