import { test, expect } from "@playwright/test";

const OH_EMAIL = process.env.E2E_OH_EMAIL!;
const OH_PASSWORD = process.env.E2E_OH_PASSWORD!;

test("private shell + /painel render after login", async ({ page }) => {
  await page.goto("/login");
  await page.locator("input[type=email]").fill(OH_EMAIL);
  await page.locator("input[type=password]").fill(OH_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/painel/);

  // Top-nav: brand link + at least the Painel tab + user pill present
  await expect(page.getByRole("link", { name: "Início" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Painel", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Menu de / })).toBeVisible();

  // Hero h1 (either "Nada pendente..." or "N aprovações aguardando...")
  const hero = page.getByRole("heading", { level: 1 });
  await expect(hero).toBeVisible();
  await expect(hero).toContainText(/(Nada pendente|aprovaç)/);

  // Quick-action grid: at least the Aprovações card
  await expect(page.getByRole("link", { name: /Aprovações.*Revisar/ })).toBeVisible();

  // Activity feed section heading
  await expect(page.getByRole("heading", { name: "Atividade recente" })).toBeVisible();

  // KPI card label
  await expect(page.getByText("Afastamentos ativos")).toBeVisible();
});
