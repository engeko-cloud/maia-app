# Phase 6 — Ishikawa investigation (DB-backed template) — design

> Sub-spec of `2026-05-14-feature-expansion-design.md`. Read the umbrella first for cross-cutting principles. This document specifies Phase 6 in full.

## 1. Problem & goal

The investigation surface for ocorrências (`/ocorrencias/[id]/investigacao`) currently renders four free-text fields (`contexto`, `causas`, `acoes`, `conclusao`). It does not model the workflow the SO/safety team actually performs: a structured root-cause analysis (Ishikawa fishbone, 6Ms), an action plan, the participants involved, and photographic evidence.

Goal: replace the placeholder with a four-section stepper form driven by DB-backed templates, ship admin pages to edit those templates, and wire the safety equipe into the ocorrência creation flow so it receives notifications.

## 2. Constraints & decisions

- **Template shape**: a single shared template applied to every ocorrência regardless of type — mirroring old-maia practice. No per-type variants in v1.
- **Sections shipped**: four — Ishikawa, Plano de Ação, Participantes, Fotos. (Old-maia also had 5 Porques and Condições de Segurança; both dropped for v1, addable later if ENGEKO asks.)
- **Ishikawa entry shape**: one entry per branch, FK to `investigacao_categorias` (admin-editable) + FK to `investigacao_graus` (admin-editable severity), plus a `causas: string[]` of free-text causes. Old-maia mental model preserved; the freeform `tipo` string is replaced by FKs.
- **Plano de Ação entry shape**: `{ acao, responsavel (free-text), prazo (ISO date), status }` in jsonb. No FK to `usuarios` for `responsavel` (field workers without logins). Status enum: `pendente | em_andamento | concluida | cancelada`.
- **Fotos storage**: reuse the `attachments` Supabase bucket with prefix `investigacoes/<ocorrencia_id>/<uuid>-<filename>`. Max 10 fotos per investigation, max 5 MB each, MIME allowlist `image/jpeg | image/png | image/webp`. No anti-virus (out of scope).
- **Permissions**: admin OR member of the `safety` equipe can edit investigations. A new helper `requireSafetyOrAdmin(supabase)` lands in `lib/permissions.ts`. Admin-only for the admin config pages.
- **Notification on new ocorrência**: email-only, sent to active members of the `safety` equipe. Fallback to active admins if the equipe is empty. No in-app notification bell (the bell backend remains deferred).
- **Lifecycle states**: unchanged. `investigacoes.situacao` flows `em_andamento` → `finalizada`. Parent ocorrência flows `aberta` → `em_investigacao` (first PATCH that writes any non-empty section) → `concluida` (on finalize). No revision / reopen state.
- **Auto-creation**: an empty `investigacoes` row is inserted by `POST /api/public/ocorrencias` immediately after the ocorrência insert succeeds, so the form is always backed by a row from day 0. No "Iniciar investigação" click — that UI branch goes away.

## 3. Data model

### 3.1 New tables (maia-db migration)

```sql
create table public.investigacao_categorias (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,
  rotulo      text not null,
  ordem       int  not null default 0,
  ativo       bool not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.investigacao_graus (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,
  rotulo      text not null,
  ordem       int  not null default 0,
  ativo       bool not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

Both mirror the shape of `afastamento_tipos` and `unidades`, so the existing `CrudTable`, PATCH, and DELETE handler patterns from Phase 5 reuse cleanly.

### 3.2 Seed data (idempotent in the same migration)

Categorias (`ordem 0..5`):

| codigo          | rotulo         |
| --------------- | -------------- |
| `mao_de_obra`   | Mão de obra    |
| `metodo`        | Método         |
| `maquina`       | Máquina        |
| `material`      | Material       |
| `medida`        | Medida         |
| `meio_ambiente` | Meio ambiente  |

Graus (`ordem 0..2`):

| codigo | rotulo |
| ------ | ------ |
| `alto` | Alto   |
| `medio`| Médio  |
| `baixo`| Baixo  |

Equipe: `insert into equipes (codigo, nome) values ('safety', 'Segurança do Trabalho') on conflict (codigo) do nothing`. Members added manually via `/admin/equipes`.

### 3.3 `investigacoes.dados` jsonb shape

```ts
type InvestigacaoDados = {
  ishikawa: Array<{
    categoria_id: string;        // FK to investigacao_categorias.id
    grau_id: string | null;      // FK to investigacao_graus.id; nullable
    causas: string[];            // each cause is free text
  }>;
  plano_acao: Array<{
    acao: string;
    responsavel: string;         // free text
    prazo: string;               // ISO 'YYYY-MM-DD'
    status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  }>;
  participantes: Array<{
    nome: string;
    email: string | null;
  }>;
  fotos: Array<{
    path: string;                // 'investigacoes/<ocorrencia_id>/<uuid>-<filename>'
    legenda: string | null;
  }>;
};
```

Every section is an array. Empty arrays are valid for a draft. Finalize requires:
- `dados.ishikawa.length >= 1`
- `dados.ishikawa[0].causas.length >= 1` (at least one ishikawa branch has at least one cause; subsequent branches may be empty)
- `dados.plano_acao.length >= 1`

`participantes` and `fotos` stay optional in all states.

### 3.4 FK integrity for jsonb references

Postgres cannot enforce a FK from a jsonb field to a table. Two compensating mechanisms:

- **Write-time**: the PATCH zod schema validates each `categoria_id` and `grau_id` resolves to an existing row before persisting. Stale ids are rejected with HTTP 400.
- **Delete-time**: DELETE on a categoria runs a pre-check `select count(*) from investigacoes where dados->'ishikawa' @> jsonb_build_array(jsonb_build_object('categoria_id', $1))`. Count > 0 → return HTTP 409 with the standard "Em uso por investigações existentes. Desative em vez de excluir." message. Same for graus with `grau_id`.
- **GIN index** on `investigacoes.dados` keeps the pre-check cheap as data grows: `create index investigacoes_dados_gin on investigacoes using gin (dados jsonb_path_ops);`.

If a categoria/grau is hand-deleted in psql (bypassing the app), the form renders the affected entries read-only with a "categoria removida" label rather than crashing. Soft-deleted categorias/graus (`ativo = false` but row still present) render read-only with a "categoria desativada" label and the rotulo from the row. This is a soft defense; primary protection against hard deletes is the DELETE pre-check.

### 3.5 `eventos.tipo` extension

Four new tipo values — two for the investigation lifecycle, two for the notification result:

| tipo                                | autor_id | payload                                         |
| ----------------------------------- | -------- | ----------------------------------------------- |
| `investigacao_iniciada`             | user     | `{}` (the act of writing is the signal)         |
| `investigacao_finalizada`           | user     | `{}`                                            |
| `ocorrencia_para_safety_enviada`    | NULL     | `{ destinatarios: string[], message_id: string }` |
| `ocorrencia_para_safety_falhou`     | NULL     | `{ destinatarios: string[], error: string }`    |

Emitted only on transitions, never on every save:
- `investigacao_iniciada`: emitted by the PATCH handler on the first save where the resulting `dados` is non-empty AND no prior `investigacao_iniciada` event exists for this entidade. Idempotent.
- `investigacao_finalizada`: emitted by the PATCH handler when the request sets `situacao: 'finalizada'` and validation passes.
- `ocorrencia_para_safety_enviada` / `_falhou`: emitted by the `POST /api/public/ocorrencias` handler after the Resend call completes.

## 4. Permissions

New helper in `lib/permissions.ts`:

```ts
export async function requireSafetyOrAdmin(supabase: SupabaseClient<Database>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('usuarios')
    .select('id, administrador, equipes_usuarios(equipes(codigo))')
    .eq('auth_id', user.id)
    .single();
  if (!profile) return null;
  if (profile.administrador) return profile;
  const inSafety = profile.equipes_usuarios?.some(
    (eu) => eu.equipes?.codigo === 'safety'
  );
  return inSafety ? profile : null;
}
```

Used by:
- `PATCH /api/ocorrencias/[id]/investigacao` (existing route, Phase 5; gated newly).
- `POST /api/private/investigacoes/upload` (new route).
- `GET /api/private/anexos/preview` (renamed from `/api/public/afastamentos/upload/preview`, gated to allow safety + admin).

`requireAdminUser` (existing) gates the admin config routes for categorias/graus.

## 5. Component & UI inventory

### 5.1 Operational form — `/ocorrencias/[id]/investigacao`

Server component fetches: ocorrência summary, the existing `investigacoes` row, active categorias + graus (`ativo = true`, ordered), timeline events. Passes everything as props to a client `<InvestigacaoForm>`.

`<InvestigacaoForm>` uses react-hook-form + zodResolver and the existing `<Stepper>` primitive from Phase 5. Four steps:

1. **Ishikawa** — for each active categoria, an `<IshikawaBranchEditor>` card: categoria rotulo (read-only header), `<Select>` for grau, repeatable `<CausasList>` rows (text + delete). Branches without any cause stay collapsed to a "+ Adicionar causa" CTA. Categorias that appear in saved dados but whose row is no longer `ativo` render read-only above the active branches, labelled "categoria desativada" (row still present). Categorias whose id has been hard-deleted render read-only labelled "categoria removida". See §3.4 for the FK-integrity rules.
2. **Plano de ação** — repeatable `<ActionItemEditor>` rows: `acao` (text), `responsavel` (text), `prazo` (date input), `status` (Select). Add/remove rows. Order preserved.
3. **Participantes** — repeatable `<ParticipanteList>` rows: `nome` (text), `email` (text, optional). Add/remove.
4. **Fotos** — `<FotoUploader>` drag-and-drop. Uploaded fotos render in a thumb grid; each thumb has a `legenda` text input below and a remove button. Click thumb → opens `/api/private/anexos/preview?path=...` in a new tab. Enforces client-side count cap (10) and size cap (5 MB) before posting; server re-enforces.

Bottom actions on every step:
- "Salvar rascunho" — PATCH dados; situacao stays `em_andamento`. Disabled while submitting.
- "Finalizar" — PATCH dados + `situacao: 'finalizada'`. Server validates the finalize gate; on success, parent ocorrência transitions to `concluida` and the user is redirected to `/ocorrencias/[id]` showing the finalized summary.

Stepper navigation: each "Próximo" calls `form.trigger([fieldNames])` to validate only the current step before advancing, matching the Phase 5 public ocorrência form pattern.

### 5.2 Admin config — `/admin/investigacao/categorias` and `/admin/investigacao/graus`

Two thin pages built on the existing `CrudTable`. Columns: `codigo`, `rotulo`, `ordem`, `ativo`. Create/edit via Sheet, delete via Dialog with 409-handling toast. Linked from `/admin` index as two cards in a new "Investigação" section.

No new admin primitives. The pages are ~30 lines each, following the `/admin/afastamento-tipos` template.

### 5.3 Ocorrência detail — `/ocorrencias/[id]` (small change)

The current `<InvestigationStarter>` callout becomes `<InvestigationStatus>`:
- If `investigacoes.situacao = 'em_andamento'` and dados is empty → CTA "Iniciar investigação" → `/ocorrencias/[id]/investigacao`.
- If `em_andamento` with non-empty dados → CTA "Continuar investigação".
- If `finalizada` → render `<InvestigacaoSummary>` server component above the timeline: a `<FieldGrid>` block with counts (causas total, ações pendentes, ações concluídas, participantes, fotos), plus a "Ver investigação" link.

### 5.4 Files

**New (client unless noted):**
- `components/investigacoes/investigacao-form.tsx` — stepper orchestrator
- `components/investigacoes/ishikawa-branch-editor.tsx`
- `components/investigacoes/action-item-editor.tsx`
- `components/investigacoes/participante-list.tsx`
- `components/investigacoes/foto-uploader.tsx`
- `components/investigacoes/investigacao-summary.tsx` (server)
- `app/(app)/ocorrencias/[id]/investigacao/page.tsx` — rewrite
- `app/(admin)/admin/investigacao/categorias/page.tsx`
- `app/(admin)/admin/investigacao/graus/page.tsx`
- `lib/investigacao-state.ts` — `INVESTIGACAO_SITUACOES`, `PLANO_ACAO_STATUS`, label resolvers
- `lib/permissions.ts` — `requireSafetyOrAdmin` (or add to existing `lib/admin-auth.ts`; final placement decided in the plan)
- `emails/ocorrencia-nova-para-safety.ts`

**Deleted:**
- `components/ocorrencias/investigacao-form.tsx` — the Phase 5 placeholder
- `components/ocorrencias/investigation-starter.tsx` (or rewritten in place — final decision in the plan)

## 6. API

### 6.1 Route inventory

**Modified:**
- `POST /api/public/ocorrencias/route.ts` — after the ocorrência insert succeeds:
  1. Insert empty `investigacoes` row.
  2. Resolve recipients: safety equipe members (active), or admins if equipe is empty.
  3. Send mail via Resend using `emails/ocorrencia-nova-para-safety.ts`.
  4. Insert `eventos` row with tipo `ocorrencia_para_safety_enviada` or `_falhou`.
  5. Failures in steps 1–4 are logged + recorded but do not fail the public submission.
- `PATCH /api/ocorrencias/[id]/investigacao/route.ts` — new zod schema for the dados shape (§3.3). On first non-empty save, emit `investigacao_iniciada` if no prior event exists. On `situacao: 'finalizada'`, enforce the finalize gate, emit `investigacao_finalizada`, and transition the parent ocorrência to `concluida`. Gated by `requireSafetyOrAdmin`.
- `GET /api/public/afastamentos/upload/preview/route.ts` — rename to `/api/private/anexos/preview/route.ts`, gated by `requireSafetyOrAdmin`, extends the path-prefix allowlist to accept both `afastamentos/` and `investigacoes/`. Old path retained as a thin re-export for one release to avoid breaking Phase 5 anexo links; deletable in Phase 7.

**New:**
- `POST /api/private/investigacoes/upload/route.ts` — auth-gated by `requireSafetyOrAdmin`. Enforces: 10 fotos max per investigation (reads current `dados.fotos.length`), 5 MB max per file, MIME allowlist. Writes to `attachments/investigacoes/<ocorrencia_id>/<uuid>-<filename>`. Returns `{ path: string }`.
- `GET/POST /api/admin/investigacao/categorias/route.ts` — list + create. Gated by `requireAdminUser`. POST zod: `{ codigo: string min 1, rotulo: string min 2, ordem?: int >= 0, ativo?: bool }`.
- `PATCH/DELETE /api/admin/investigacao/categorias/[id]/route.ts` — `Patch` zod with all-optional fields. DELETE runs the jsonb pre-check (§3.4) and returns 409 with the friendly message on conflict.
- `GET/POST /api/admin/investigacao/graus/route.ts` — analogous.
- `PATCH/DELETE /api/admin/investigacao/graus/[id]/route.ts` — analogous, with the equivalent jsonb pre-check for `grau_id`.

### 6.2 Notification flow

```
POST /api/public/ocorrencias
  ├─ insert ocorrencia
  ├─ insert empty investigacao (dados: { ishikawa: [], plano_acao: [], participantes: [], fotos: [] })
  ├─ resolve recipients:
  │    select u.email
  │      from equipes_usuarios eu
  │      join usuarios u on u.id = eu.usuario_id
  │      join equipes  e on e.id = eu.equipe_id
  │     where e.codigo = 'safety' and u.ativo = true
  │   if empty: select email from usuarios where administrador = true and ativo = true
  ├─ send mail via Resend (template: emails/ocorrencia-nova-para-safety.ts)
  └─ insert eventos row:
       success: tipo='ocorrencia_para_safety_enviada', payload={destinatarios, message_id}
       failure: tipo='ocorrencia_para_safety_falhou',  payload={destinatarios, error}
```

The submission returns 201 regardless of email/event outcome. Operational visibility into failures lives in Phase 7's `/painel/saude`.

### 6.3 State machine

`investigacoes.situacao`:

```
em_andamento ──finalize──▶ finalizada
```

Parent `ocorrencias.situacao`:

```
aberta ──first non-empty PATCH──▶ em_investigacao ──finalize──▶ concluida
```

No reopens, no revisions. If ENGEKO later asks for reopen, it's a follow-up phase.

### 6.4 Concurrency

PATCH uses optimistic check on the parent ocorrência: `update investigacoes ... where ocorrencia_id = ? returning *`. If 0 rows affected (someone deleted the row), return 409. Two safety-team members editing simultaneously: last write wins on jsonb (matching afastamentos approval concurrency posture per DOCUMENTACAO §17.2). Not addressed in v1.

## 7. Testing

### 7.1 Vitest (4 new test files)

- `tests/unit/investigacao-dados-schema.test.ts` — zod accepts valid dados; rejects empty `ishikawa[].causas`; rejects non-uuid `categoria_id` / `grau_id`; rejects non-ISO `prazo`; rejects invalid `status`; finalize gate requires non-empty `ishikawa[0].causas` and non-empty `plano_acao`.
- `tests/unit/investigacao-permissions.test.ts` — `requireSafetyOrAdmin` returns the profile when user is admin alone, when user is safety-equipe member alone, when user is both; returns `null` for neither and for inactive users.
- `tests/unit/investigacao-jsonb-fk-check.test.ts` — DELETE pre-check query is correctly shaped (`@>` operator, `jsonb_build_object` payload, parameter binding for both `categoria_id` and `grau_id` variants).
- `tests/unit/safety-notify.test.ts` — recipient resolver returns safety equipe members when populated; falls back to admins when empty; dedupes addresses; excludes inactive users.

### 7.2 Deno

None new. No edge functions are touched.

### 7.3 Playwright

Extend `tests/e2e/happy-path.spec.ts` with one additional arc, gated by an env flag (`E2E_INVESTIGACAO=1`) so it skips when seed data is unavailable:

1. From the existing OH-admin session, submit a public ocorrência via `/forms/ocorrencias`.
2. Open `/ocorrencias` list, click the new ocorrência, navigate to `/ocorrencias/[id]/investigacao`.
3. Step through: one Ishikawa branch with one causa, one plano-de-ação row, one participante, skip fotos.
4. Click Finalizar.
5. Verify parent ocorrência shows `concluida` in the list and the `<InvestigacaoSummary>` renders on the detail page.

### 7.4 Smoke psql (RLS)

Add three lines to the existing smoke script:
- `select * from investigacao_categorias` succeeds as an authenticated non-admin (read).
- `update investigacao_categorias set rotulo='x'` fails as a non-admin (write).
- `update investigacoes set dados='{}'` succeeds as a `safety` equipe member, fails as a non-admin non-safety user.

## 8. Deploy sequence

Per existing convention (DOCUMENTACAO §15):

1. **maia-db** — apply migration `<timestamp>_investigacao_phase_6.sql`:
   - Create `investigacao_categorias`, `investigacao_graus`.
   - Seed 6 categorias, 3 graus.
   - Insert `safety` row into `equipes` if not exists.
   - Extend `eventos.tipo` check constraint with the four new values.
   - Create GIN index on `investigacoes.dados`.
2. **maia-app** — run `supabase gen types typescript --local`, commit regenerated types, ship the new components + routes + email template.
3. **Manual one-time** — ENGEKO admin opens `/admin/equipes` and adds members to the `safety` equipe. Until this step runs, the notification fallback to admins covers correctness.

## 9. Success criteria

1. Opening `/ocorrencias/[id]/investigacao` renders a 4-step stepper form whose Ishikawa branches and severity options are loaded from `investigacao_categorias` and `investigacao_graus` — **not** from any `lib/data/*.json` file.
2. A safety-team admin can finalize an investigation in a single sitting, and the parent ocorrência transitions to `concluida` automatically.
3. Creating an ocorrência via `/forms/ocorrencias` triggers a `Nova ocorrência registrada — investigação pendente` email to every active safety-team member (or to admins as fallback), and emits the corresponding `ocorrencia_para_safety_enviada` event.
4. An ENGEKO admin can add a new Ishikawa categoria via `/admin/investigacao/categorias` and it appears in the next investigation form. Deleting an in-use categoria returns 409 with the friendly message.
5. Fotos are accessible only through the auth-gated signed-URL preview route — never via public storage URL.
6. The existing Playwright happy-path stays green. The new investigation arc passes when `E2E_INVESTIGACAO=1`.

## 10. Out of scope (Phase 6)

- Anti-virus scanning on fotos.
- Cross-investigation aggregation queries (belongs to Phase 7).
- Per-type Ishikawa templates.
- 5 Porques and Condições de Segurança sections (old-maia had them; Phase 6 ships without).
- Investigation revision / reopen flow (`finalizada → em_andamento`).
- FK from `plano_acao.responsavel` to `usuarios.id` (free text in v1).
- Cross-investigation "minhas ações" page.
- Notification bell backend.
- In-app realtime updates for the investigation form.

## 11. Risks

- **Safety equipe empty at deploy**. Mitigation: admin fallback in the notification resolver keeps the workflow functional from day 1. Deploy step 3 documents the seed.
- **5 MB foto cap pushback**. If safety photographs machinery in detail, 5 MB may be tight. Raising to 10 MB is a one-line change. Decision deferred until real usage data.
- **jsonb FK drift via manual psql edits**. Mitigation: form renders affected entries read-only ("categoria desativada/removida"). Primary defense is the DELETE pre-check in §3.4.
- **Old `/api/public/afastamentos/upload/preview` link rot**. Mitigation: keep the old path as a thin re-export for one release; Phase 7 deletes it.
- **Mass-finalize race** (two safety members clicking Finalizar simultaneously). Last write wins on jsonb; the second finalize PATCH is effectively idempotent because the situacao is already `finalizada`. Acceptable per §6.4 and DOCUMENTACAO §17.2.

---

> Spec written 2026-05-14, immediately after the umbrella feature-expansion spec. Implementation plan to be produced by the writing-plans skill once this spec is approved.
