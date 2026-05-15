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

    // 3. Step 1 — fill the first Ishikawa branch by picking a library causa
    await page.getByRole("button", { name: /Adicionar causa/i }).first().click();
    // Pick the first library suggestion from the Select on the new causa row
    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();
    // The descricao Input is now auto-filled from the library
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

test.describe("Phase 8 portal", () => {
  test.skip(!process.env.E2E_PORTAL, "set E2E_PORTAL=1 to run");

  test("colaborador sees own afastamentos and detail view", async ({ page }) => {
    // Bypass OTP in tests: use admin API to generate a magic link for the seeded user,
    // then navigate to it with next=/portal/painel so auth/confirm redirects there.
    const { createClient } = await import("@supabase/supabase-js");
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: "colaborador@seed.local",
    });
    if (error || !data?.properties?.action_link) {
      throw new Error(`Failed to generate portal login link: ${error?.message}`);
    }

    // Inject next=/portal/painel so auth/confirm redirects to the portal.
    const confirmUrl = new URL(data.properties.action_link);
    confirmUrl.searchParams.set("next", "/portal/painel");

    await page.goto(confirmUrl.toString());
    await expect(page).toHaveURL(/\/portal\/painel/, { timeout: 10_000 });

    // Assert greeting and list render.
    // The seeded CPF 11111111111 = Ana Silva (from 017_seed_dev.sql).
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ana Silva");
    const dataRows = page.getByRole("row").filter({ hasNot: page.getByRole("columnheader") });
    await expect(dataRows).not.toHaveCount(0);

    // Click the first row link to reach the detail page.
    await page.getByRole("link").filter({ hasText: /Doença|Acidente/ }).first().click();
    await expect(page).toHaveURL(/\/portal\/afastamentos\/[a-f0-9-]+/);

    // Assert status detail renders.
    await expect(page.getByText(/Pendente|Finalizado|Rejeitado|Cancelado/)).toBeVisible();

    // Assert no medical/sensitive fields appear.
    await expect(page.getByText(/\bCID\b/i)).not.toBeVisible();
    await expect(page.getByText(/\bINSS\b/i)).not.toBeVisible();
    await expect(page.getByText(/Internação/i)).not.toBeVisible();

    // Assert no approval bar or admin controls.
    await expect(page.getByRole("button", { name: /Aprovar|Rejeitar/i })).not.toBeVisible();
  });
});
