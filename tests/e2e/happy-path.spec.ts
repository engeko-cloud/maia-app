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

test.describe("Phase 6 investigation", () => {
  test.skip(!process.env.E2E_INVESTIGACAO, "set E2E_INVESTIGACAO=1 to run");

  test("OH admin finalizes Ishikawa investigation end-to-end", async ({ page }) => {
    // Pre-condition: signed in as OH admin and a public ocorrência has just been submitted
    //                (the previous happy-path test does this).

    // 1. Navigate to the most recent ocorrência via the list
    await page.goto("/ocorrencias");
    const firstRow = page.getByRole("link", { name: /Ver detalhes/i }).first();
    await firstRow.click();
    await expect(page).toHaveURL(/\/ocorrencias\/[a-f0-9-]+$/);

    // 2. Click "Iniciar investigação"
    await page.getByRole("link", { name: /Iniciar investigação|Continuar investigação/ }).click();
    await expect(page).toHaveURL(/\/investigacao$/);

    // 3. Step 1 — fill the first Ishikawa branch
    await page.getByRole("button", { name: /Adicionar causa/i }).first().click();
    await page.getByPlaceholder("Descreva a causa").first().fill("Falta de procedimento");
    // grau: pick the first option
    await page.getByLabel(/Grau/i).first().click();
    await page.getByRole("option", { name: /Alto|Médio|Baixo/ }).first().click();

    // 4. Step 2 — plano de ação
    await page.getByRole("button", { name: /Próximo/i }).click();
    await page.getByRole("button", { name: /Adicionar ação/i }).click();
    await page.getByLabel("Ação").fill("Atualizar procedimento padrão");
    await page.getByLabel("Responsável").fill("João Equipe");
    await page.getByLabel("Prazo").fill("2026-12-31");
    // status defaults to pendente

    // 5. Step 3 — participantes
    await page.getByRole("button", { name: /Próximo/i }).click();
    await page.getByRole("button", { name: /Adicionar participante/i }).click();
    await page.getByLabel("Nome").fill("Maria Equipe");

    // 6. Skip fotos, finalize
    await page.getByRole("button", { name: /Finalizar/i }).click();
    await expect(page).toHaveURL(/\/ocorrencias\/[a-f0-9-]+$/);

    // 7. Verify parent ocorrência is concluida + summary renders
    await expect(page.getByText("Concluída")).toBeVisible();
    await expect(page.getByText("Investigação finalizada")).toBeVisible();
  });
});
