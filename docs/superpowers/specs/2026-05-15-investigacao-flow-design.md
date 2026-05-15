# Investigação Flow — Design Spec

**Date:** 2026-05-15
**Scope:** Rebuild the ocorrência → investigação flow with auto-creation, public token-gated multi-actor editing, sequential step gating, safety-team approval lifecycle (mirrors afastamentos), in-app code-rendered report, and server-side PDF export.

---

## 1. Goals

- Every new ocorrência **auto-starts an investigação** — no manual "Iniciar investigação" step required.
- The submitter receives a public, token-gated edit link in the confirmation email so they (or anyone they forward it to) can fill the investigation.
- Public flow is **hard step-gated**: each step's minimum must be satisfied before advancing. Admin flow stays free.
- Investigations now go through a **safety-team approval lifecycle**: submitted → reviewed → approved/rejected, with the rejected branch reopening public edits.
- A **rendered report** replaces the old Google Docs templating workflow: one React component drives both the on-screen share view and the server-rendered PDF.

## 2. Non-goals

- Editable per-org template strings (the report is code-controlled).
- Real-time multi-user collaboration during editing — concurrent edits use last-write-wins via autosave.
- Migration of legacy investigations from old-maia (out of scope here).
- The "5 porquês" section from old-maia — removed entirely.

## 3. Data model

### 3.1 New migration `022_investigacoes_workflow.sql`

1. Drop and re-add `investigacoes_situacao_check`. New values:
   `('em_andamento','em_aprovacao','aprovada','rejeitada','cancelada')`.
2. Pre-existing data: `update investigacoes set situacao = 'aprovada' where situacao = 'finalizada'`. Drop `'arquivada'` if any rows exist (none expected at this point — confirm before running).
3. Add columns:
   - `token_publico uuid unique not null default gen_random_uuid()`
   - `decidido_por uuid references usuarios(id)`
   - `decidido_em timestamptz`
   - `motivo_rejeicao text`
   - `enviada_em timestamptz`
4. Index: `idx_investigacoes_token_publico on investigacoes(token_publico)`.
5. CHECK: `motivo_rejeicao` must be non-null when `situacao = 'rejeitada'`. Enforced via constraint:
   ```sql
   alter table investigacoes add constraint investigacoes_rejeicao_motivo
     check (situacao <> 'rejeitada' or motivo_rejeicao is not null);
   ```

### 3.2 Ocorrência situacao derivation (route-level, no migration)

Existing route handlers already write `ocorrencias.situacao` when investigation state changes (see `app/api/ocorrencias/[id]/investigacao/route.ts:50-60`). We extend the same pattern in the new decision routes. No DB trigger, no migration — purely route code.

| `investigacoes.situacao` | derived `ocorrencias.situacao` |
|---|---|
| `em_andamento` (no dados) | `aberta` |
| `em_andamento` (any dados) | `em_investigacao` |
| `em_aprovacao` | `em_investigacao` |
| `rejeitada` | `em_investigacao` |
| `aprovada` | `concluida` |
| `cancelada` | `cancelada` |

### 3.3 RLS

Existing `013_rls.sql` already covers `investigacoes` (admin/safety read+write). Service-role bypass is used for all public token routes. No new policies needed.

### 3.4 Type regeneration

Run `supabase gen types typescript --local` after migration 022 applies. Never edit `lib/supabase/database.types.ts` by hand.

## 4. Step-gate module

New: `lib/investigacao-step-gates.ts`. Pure functions, no dependencies on Supabase or Next.

```ts
export const STEP_GATES = [
  { step: 'ishikawa',      min: (d) => d.ishikawa.some(b => b.causas.length > 0) },
  { step: 'plano_acao',    min: (d) => d.plano_acao.length >= 1 },
  { step: 'participantes', min: (d) => d.participantes.length >= 1 },
  { step: 'fotos',         min: () => true },  // optional
] as const;

export function assertSubmittable(dados: InvestigacaoDados): void {
  // Throws first unmet gate (excluding the fotos optional one) with a clear message.
}
```

Per-field completeness on plano_acao items is already enforced by `InvestigacaoDadosSchema` (`acao.min(1)`, `responsavel.min(1)`, `prazo` ISO regex, `status` enum) — so `length >= 1` is sufficient at the gate layer.

`assertSubmittable` is used by:
- Public `/submeter` route
- Admin `/aprovar` route

Single source of truth for "what makes an investigation complete".

## 5. Routes & API surface

### 5.1 Public (token-gated, admin Supabase client, no auth required)

| Verb | Path | Purpose |
|---|---|---|
| GET | `/investigacoes/editar/[token]` | Public investigation form. Read-only if situacao ∈ (`em_aprovacao`, `aprovada`, `cancelada`). Editable if `em_andamento` or `rejeitada`. |
| GET | `/ocorrencias/relatorio/[token]` | Public read-only report view. Renders only when situacao ∈ (`em_aprovacao`, `aprovada`). Other situacoes redirect to the edit URL. |
| POST | `/api/public/investigacoes/[token]` | Autosave. Body `{ dados: InvestigacaoDados }`. 422 on schema violation. Preserves situacao (`em_andamento` stays `em_andamento`; `rejeitada` stays `rejeitada`). |
| POST | `/api/public/investigacoes/[token]/submeter` | Public finalize → `em_aprovacao`. Runs `assertSubmittable`. Sets `enviada_em = now()`. Sends `investigacao-em-aprovacao` to safety team. |
| POST | `/api/public/investigacoes/[token]/foto` | Token-auth foto upload. Mirrors private upload (5MB / 10 max / image mime). |

### 5.2 Admin (`requireSafetyOrAdmin`)

| Verb | Path | Purpose |
|---|---|---|
| GET | `/ocorrencias/[id]/investigacao` (existing) | Admin form. Extended with situacao-aware decision action bar. |
| POST | `/api/ocorrencias/[id]/investigacao` (existing) | Existing autosave. Modified: preserves `em_aprovacao` instead of forcing `em_andamento` when admin saves an `em_aprovacao` row. |
| POST | `/api/ocorrencias/[id]/investigacao/aprovar` (new) | Runs `assertSubmittable`. Sets situacao=`aprovada`, `decidido_por`, `decidido_em`. Sends `investigacao-aprovada` to submitter. |
| POST | `/api/ocorrencias/[id]/investigacao/rejeitar` (new) | Body `{ motivo_rejeicao: string }`. Sets situacao=`rejeitada`, `decidido_por`, `decidido_em`. Sends `investigacao-rejeitada` to submitter. |
| POST | `/api/ocorrencias/[id]/investigacao/reabrir` (new) | situacao `aprovada` → `em_andamento`. Clears `decidido_por`, `decidido_em`, `motivo_rejeicao`, `enviada_em`. No email. |
| GET | `/api/public/investigacoes/[token]/pdf` (new) | Server-rendered PDF via `puppeteer-core` + `@sparticuz/chromium`. Renders the report URL, returns `application/pdf`. |

### 5.3 Modified create route

`POST /api/public/ocorrencias` (existing) — investigation auto-create stays as today. Two additions:
- Select `token_publico` back from the investigacao insert.
- Pass `investigacao_url = ${baseUrl}/investigacoes/editar/${token_publico}` into the `ocorrencia-receipt` email payload.

## 6. Public form (`<PublicInvestigacaoForm>`)

**Path:** `app/(public)/investigacoes/editar/[token]/page.tsx` (server) + client form.
**Sub-components reused:** `IshikawaBranchEditor`, `ActionItemEditor`, `ParticipanteList`, `FotoUploader` (the foto uploader gets a new prop to use the public token endpoint).

**Step gating UX:**
- Stepper component visible at top; "Avançar" disabled until `STEP_GATES[currentStep].min(dados)` returns true.
- Disabled button has a tooltip showing what's missing (e.g., *"Adicione ao menos uma causa em qualquer categoria"*).
- "Voltar" always enabled (revisiting earlier steps OK).
- Autosave on field-blur, debounced 800ms, posts to autosave route. Status indicator: `Salvando…` → `Salvo às HH:mm`.
- "Enviar para aprovação" replaces the "Próximo" button on the last step. POSTs `/submeter`. On 200: redirect to status page with success toast. On 422: stay on the violating step.

**State-conditional rendering:**
- `em_andamento`: full edit + step nav.
- `rejeitada`: prominent red banner with `motivo_rejeicao`. Full edit re-enabled. On submit goes back to `em_aprovacao`.
- `em_aprovacao` / `aprovada`: read-only. Banner: *"Esta investigação está aguardando aprovação."* / *"Esta investigação foi aprovada em DD/MM/AAAA."* Step nav becomes section nav (no autosave, no buttons). "Ver relatório" link prominent.
- `cancelada`: read-only with cancelled banner.

## 7. Admin form (extension of existing `<InvestigacaoForm>`)

**No restructure** — current component stays. Added:

**`<DecisionActionBar>`** at the bottom of the form, replaces the existing "Salvar rascunho" + "Finalizar" pair:

| Current situacao | Buttons |
|---|---|
| `em_andamento` | Salvar rascunho · **Aprovar** (runs assertSubmittable) |
| `em_aprovacao` | Salvar (preserves em_aprovacao) · **Rejeitar** (modal) · **Aprovar** |
| `rejeitada` | Salvar rascunho · **Rejeitar** (update motivo) · **Aprovar** |
| `aprovada` | Read-only · **Ver relatório** · **Reabrir** |
| `cancelada` | Read-only |

- **Rejeitar modal**: textarea for `motivo_rejeicao` (required, min 10 chars). Lifts the same pattern as the afastamento rejection modal.
- **Aprovar**: on success, toast + inline "Ver relatório" link. Stays on detail page (admin doesn't lose context).
- Step navigation in admin form is **unchanged** (free Voltar/Próximo). No public-style hard gating in admin.

## 8. Emails

### 8.1 Modified: `ocorrencia-receipt`

- Add optional `investigacao_url?: string` to type.
- Below the existing "Acompanhar status" CTA, add second button **"Preencher investigação"** → `investigacao_url`.
- Copy update: *"Sua ocorrência #{id} foi registrada. Para iniciar a investigação, use o botão abaixo. Você pode acompanhar o andamento a qualquer momento."*

### 8.2 Kept: `ocorrencia-nova-para-safety`

Fires at ocorrência creation (heads-up to safety team that the case exists and the auto-investigation has been opened). Existing copy + admin link unchanged.

### 8.3 New: `investigacao-em-aprovacao`

- **To:** safety team via `resolveSafetyRecipients`.
- **Subject:** `Investigação #{serial_id} pronta para aprovação`
- **Body:** ocorrência summary (tipo, data, empresa, unidade) + investigation summary (`N causas, M ações, P participantes, F fotos`) + CTA **"Revisar e decidir"** → `/ocorrencias/{ocorrencia_id}/investigacao`.
- **Trigger:** `POST /api/public/investigacoes/[token]/submeter`.

### 8.4 New: `investigacao-rejeitada`

- **To:** ocorrência's `email_remetente`.
- **Subject:** `Investigação #{serial_id} precisa de ajustes`
- **Body:** `motivo_rejeicao` (verbatim, escaped) + CTA **"Editar investigação"** → `/investigacoes/editar/[token]`.
- **Trigger:** admin reject route.

### 8.5 New: `investigacao-aprovada`

- **To:** ocorrência's `email_remetente`.
- **Subject:** `Investigação #{serial_id} concluída`
- **Body:** short summary + CTA **"Ver relatório"** → `/ocorrencias/relatorio/[token]`.
- **Trigger:** admin approve route.

### 8.6 Template registry

Extend `lib/mail/send.ts` `TEMPLATES` with the 3 new keys. Subjects use the existing `tagId(serial_id)` helper.

## 9. Report renderer (`<InvestigacaoReport>`)

**Component:** `components/investigacoes/investigacao-report.tsx`. Pure React, no template DSL, no markdown. Used by:
1. The public report page `/ocorrencias/relatorio/[token]` (server component loads by `token_publico`, embeds the component inside a print-friendly shell).
2. Optional admin "Preview" tab on the detail page (same component, same data).
3. The puppeteer route, which navigates to `(1)` and prints.

**Report sections:**

1. **Header** — empresa logo (if `configuracoes.logo_url`), serial_id chip, ocorrência tipo + data, situacao chip. If `aprovada`: `decidido_por.nome` + `decidido_em` formatted date.
2. **Resumo da ocorrência** — colaborador (nome, CPF, setor, cargo), tipo_local, descrição.
3. **Atendimento médico** (rendered only if `atendimento === true`) — data/hora_atendimento, afastamento duração, CID, parecer médico, internação, morte, BO.
4. **Análise Ishikawa** — one card per categoria that has causas (skip empty). Each card: categoria rotulo, grau badge, causa list.
5. **Plano de ação** — table: ação · responsável · prazo · status (status colored chip).
6. **Participantes** — name + email list.
7. **Galeria de fotos** — grid of `<img>` with `legenda` below. Section hidden when empty.
8. **Footer** — `Relatório gerado em {now}` + permalink text.

**Styling:**
- Stays in the existing design-token system (`rounded-md` cap, no `rounded-full`, no emojis).
- A `@media print` stylesheet hides the app shell, removes background tint, sets A4 page margins.

## 10. PDF route

**Path:** `GET /api/public/investigacoes/[token]/pdf`

**Implementation:**
```ts
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  args: chromium.args,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
});
const page = await browser.newPage();
await page.goto(`${baseUrl}/ocorrencias/relatorio/${token}`, { waitUntil: "networkidle0" });
const pdf = await page.pdf({ format: "A4", printBackground: true });
await browser.close();
return new Response(pdf, { headers: { "Content-Type": "application/pdf" } });
```

**Constraints:**
- Only renders when situacao ∈ (`em_aprovacao`, `aprovada`). Returns 409 otherwise.
- Disposable browser per request (no pooling in v1; we can add a singleton later if cost is an issue).
- `@sparticuz/chromium` is the Vercel/Lambda-friendly serverless Chromium.

## 11. Build order

1. **DB migration 022** — apply local + remote. Regen `database.types.ts`.
2. **`lib/investigacao-step-gates.ts`** — pure functions + unit tests.
3. **Public investigation form** at `/(public)/investigacoes/editar/[token]` + autosave route + foto upload route. Rejeitada banner. Read-only states.
4. **Public submeter route + `investigacao-em-aprovacao` email**.
5. **Admin decision routes** (`aprovar`, `rejeitar`, `reabrir`) + `<DecisionActionBar>` extension to existing `<InvestigacaoForm>` + emails `investigacao-rejeitada`, `investigacao-aprovada`.
6. **Receipt email update** — `investigacao_url` second CTA on `ocorrencia-receipt`, wired from create route.
7. **`<InvestigacaoReport>`** + public report page `/ocorrencias/relatorio/[token]`.
8. **PDF route** with `puppeteer-core` + `@sparticuz/chromium`. Add to `package.json` deps.
9. **Admin "Ver relatório"** link wired into approve success path.

## 12. Files touched

**New files (≈10):**
- `maia-db/supabase/migrations/022_investigacoes_workflow.sql`
- `lib/investigacao-step-gates.ts`
- `app/(public)/investigacoes/editar/[token]/page.tsx`
- `app/(public)/investigacoes/editar/[token]/form.tsx` (client component)
- `app/api/public/investigacoes/[token]/route.ts`
- `app/api/public/investigacoes/[token]/submeter/route.ts`
- `app/api/public/investigacoes/[token]/foto/route.ts`
- `app/api/public/investigacoes/[token]/pdf/route.ts`
- `app/api/ocorrencias/[id]/investigacao/aprovar/route.ts`
- `app/api/ocorrencias/[id]/investigacao/rejeitar/route.ts`
- `app/api/ocorrencias/[id]/investigacao/reabrir/route.ts`
- `app/(public)/ocorrencias/relatorio/[token]/page.tsx`
- `components/investigacoes/investigacao-report.tsx`
- `components/investigacoes/decision-action-bar.tsx`
- `emails/investigacao-em-aprovacao.ts`
- `emails/investigacao-rejeitada.ts`
- `emails/investigacao-aprovada.ts`

**Modified files (≈8):**
- `lib/supabase/database.types.ts` (regenerated)
- `lib/mail/send.ts` (3 new template registrations)
- `emails/ocorrencia-receipt.ts` (second CTA)
- `app/api/public/ocorrencias/route.ts` (build investigacao_url, pass to receipt email)
- `app/api/ocorrencias/[id]/investigacao/route.ts` (preserve em_aprovacao on admin save)
- `components/investigacoes/investigacao-form.tsx` (wire decision-action-bar)
- `app/(app)/ocorrencias/[id]/investigacao/page.tsx` (pass current situacao + decidido_por to form)
- `package.json` (puppeteer-core + @sparticuz/chromium)

## 13. Open items / explicit non-decisions

- **Concurrent edits:** last-write-wins via autosave. No optimistic locking in v1.
- **Public foto upload size cap:** same as private (5MB / 10 max). Consider lowering for public if abuse appears.
- **Puppeteer cost on serverless:** disposable browser per request. Acceptable for low PDF volume; revisit with pooled instance if needed.
- **Old-maia data migration:** out of scope.
