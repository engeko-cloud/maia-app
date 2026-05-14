import { test, expect } from "@playwright/test";

const OH_EMAIL = process.env.E2E_OH_EMAIL!;
const OH_PASSWORD = process.env.E2E_OH_PASSWORD!;
const TEST_CPF = process.env.E2E_TEST_CPF!;

test("submit afastamento → OH approves", async ({ page }) => {
  // 1. Submit public form
  await page.goto("/forms/afastamentos");
  await page.locator("input[placeholder='CPF (11 dígitos)']").fill(TEST_CPF);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.locator("input[name='colaborador_nome']")).not.toHaveValue("");
  // Phase 5: native <select> replaced by shadcn Select (combobox)
  await page.getByLabel("Tipo de afastamento").click();
  await page.getByRole("option", { name: "Doença" }).click();
  await page.locator("input[name='data_inicio']").fill("2026-05-13");
  await page.locator("input[name='email_remetente']").fill("e2e@example.com");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Enviado.")).toBeVisible();

  // 2. Log in as OH user
  await page.goto("/login");
  await page.locator("input[type=email]").fill(OH_EMAIL);
  await page.locator("input[type=password]").fill(OH_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/painel/);

  // 3. Approve from detail page (Phase 5 moved Aprovar/Rejeitar inline on the detail page)
  await page.goto("/afastamentos/aprovacoes");
  await page.getByRole("link", { name: /Ver detalhes/i }).first().click();
  await expect(page).toHaveURL(/\/afastamentos\/[\w-]+/);
  await page.getByRole("button", { name: "Aprovar" }).click();
  await expect(page.getByText("Aprovado.")).toBeVisible();
});
