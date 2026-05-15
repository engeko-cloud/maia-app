# Phase 8 — Self-service portal (colaborador surface)

> Sub-spec for Phase 8 of the feature expansion umbrella (`2026-05-14-feature-expansion-design.md`). Brainstormed and approved 2026-05-14.

## 1. Problem & goal

Colaboradores submit afastamentos via the public form but have no way to check the status of their own submissions afterward. Every "cadê meu atestado?" call to the SO is avoidable. Phase 8 ships a read-only self-service portal scoped to the submitting colaborador's CPF, accessible via email OTP.

## 2. Scope

**In scope:**
- `/portal/login` — email OTP entry point (separate from staff `/login`)
- `/portal/cadastro` — first-time CPF linkage (post-OTP, pre-profile)
- `/portal/painel` — list of the colaborador's own afastamentos
- `/portal/afastamentos/[id]` — simplified status detail view

**Out of scope (explicit):**
- Ocorrências in the portal (no CPF column on `ocorrencias`; deferred)
- Colaborador ability to edit or cancel their own afastamentos
- SMS OTP (would require a new external service; prohibited by umbrella §3)
- Multi-tenant support

## 3. Design decisions

| Question | Decision | Rationale |
|---|---|---|
| Auth method | Email OTP | Native Supabase, no new services, works across devices |
| Portal scope | Afastamentos only | Ocorrências lack a CPF column; clean deferral |
| Identity mapping | Dedicated `colaboradores` table | Clean boundary from staff `usuarios`; RLS-friendly |
| Registration guard | CPF must match ≥1 existing afastamento | Prevents drive-by account creation |
| Detail view | Simplified status view | Status, tipo, datas only — no CID/medical/timeline |
| Data access | Server components + new RLS policies | Mirrors `(app)` group pattern; no new API routes for reads |

## 4. Database layer

### 4.1 New table: `colaboradores`

```sql
create table colaboradores (
  id        uuid primary key references auth.users(id) on delete cascade,
  cpf       text not null unique,
  criado_em timestamptz not null default now()
);

alter table colaboradores enable row level security;

create policy colaboradores_self_read on colaboradores for select
  using ((select auth.uid()) = id);
```

No `nome` column — `colaborador_nome` is read from `afastamentos` at query time. Writes are service-role only (no INSERT/UPDATE/DELETE RLS policies, consistent with all other tables).

### 4.2 SQL helper function

```sql
create or replace function colaborador_cpf(uid uuid) returns text
  language sql stable security definer
  set search_path = ''
  as $$ select cpf from public.colaboradores where id = uid $$;

revoke execute on function colaborador_cpf(uuid) from public;
```

### 4.3 New RLS policy on `afastamentos`

```sql
create policy afastamentos_colaborador_read on afastamentos for select
  using (cpf = colaborador_cpf((select auth.uid())));
```

The existing `afastamentos_read` policy (admin OR `oh` team) stays unchanged. Supabase evaluates policies with OR — a colaborador who is not in the `oh` team matches via `afastamentos_colaborador_read` instead.

### 4.4 Portal copy columns on `configuracoes`

```sql
alter table configuracoes
  add column portal_saudacao text not null default 'Olá, {nome}.',
  add column portal_vazio    text not null default 'Nenhum afastamento registrado para o seu CPF.',
  add column portal_banner   text not null default 'Consulte o status dos seus afastamentos registrados na ENGEKO.';
```

`{nome}` in `portal_saudacao` is replaced at render time with `colaborador_nome` from the most recent afastamento row. These three columns are editable at `/admin/configuracoes`.

### 4.5 Dev seed addition (new migration)

A seeded Supabase auth user `colaborador@seed.local` (fixed UUID) with a `colaboradores` row pointing to a CPF that exists on a seeded afastamento. Used by the E2E arc.

## 5. Auth flow

### 5.1 `/portal/login`

Client component. Two-step UI:

**Step 1 — email:**
```ts
await supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: true },
});
```
Always shows "se o email estiver cadastrado, você receberá um código" — no enumeration of whether the email exists.

**Step 2 — OTP code:**
```ts
await supabase.auth.verifyOtp({ email, token, type: "email" });
// on success → redirect to /portal
```

`shouldCreateUser: true` so first-time colaboradores get a Supabase auth user automatically. They have no `usuarios` row, so `requireAdminUser()` and `requireSafetyOrAdmin()` return null — staff app stays inaccessible.

### 5.2 `/portal/cadastro`

Shown after OTP login when no `colaboradores` row exists for the session user. One field: CPF (masked input, 11 digits).

POST handler at `/api/portal/cadastro` (service-role):
1. Validate CPF format.
2. `select count(*) from afastamentos where cpf = $1` — must be ≥ 1.
3. If not found → 422 `{ error: "CPF não encontrado nos nossos registros." }`.
4. `INSERT INTO colaboradores (id, cpf) VALUES ($uid, $cpf)` via service-role.
5. On success → 200, client redirects to `/portal/painel`.

### 5.3 `requireColaborador()` helper

`lib/portal-auth.ts`:

```ts
export type ColaboradorSession =
  | { status: "unauthenticated" }
  | { status: "no_profile"; user: User }
  | { status: "ok"; user: User; cpf: string };

export async function requireColaborador(): Promise<ColaboradorSession> {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "unauthenticated" };
  const { data } = await supabase
    .from("colaboradores")
    .select("cpf")
    .eq("id", user.id)
    .single();
  if (!data) return { status: "no_profile", user };
  return { status: "ok", user, cpf: data.cpf };
}
```

Page server components call this and redirect based on status:
- `unauthenticated` → `/portal/login`
- `no_profile` → `/portal/cadastro`
- `ok` → proceed

### 5.4 Middleware

`middleware.ts` extended:

```ts
const isPortalPublic = path.startsWith("/portal/login") || path.startsWith("/portal/cadastro");
const isPortal = path === "/portal" || path.startsWith("/portal/");

if (isPortal && !isPortalPublic && !user) {
  return NextResponse.redirect(new URL("/portal/login", request.url));
}
```

The existing staff `protectedPrefixes` array stays unchanged.

## 6. Route group and layout

### 6.1 Directory structure

Two route groups keep the auth gate out of the public portal pages:

```
app/(portal-public)/
  portal/
    login/
      page.tsx        ← no layout, no auth gate
    cadastro/
      page.tsx        ← no layout, no auth gate

app/(portal)/
  layout.tsx          ← auth gate + minimal shell
  portal/
    painel/
      page.tsx
    afastamentos/
      [id]/
        page.tsx

app/api/portal/
  cadastro/
    route.ts
```

Both groups produce URLs under `/portal/` — the group names are invisible to the router.

### 6.2 Layout

`app/(portal)/layout.tsx` — server component. Calls `requireColaborador()` and redirects:
- `unauthenticated` → `/portal/login`
- `no_profile` → `/portal/cadastro`
- `ok` → renders the authenticated shell

Authenticated shell: logo + "Minha Área" wordmark left, logout button right. No `AppTopNav`, no dropdown nav. Completely isolated from the staff shell.

## 7. Portal pages

### 7.1 `/portal/painel`

Server component. Calls `requireColaborador()` for CPF. Queries:

```ts
supabase
  .from("afastamentos")
  .select("id, situacao, afastamento_tipos!inner(rotulo), data_inicio, data_fim, duracao, empresas!inner(nome), colaborador_nome")
  .eq("cpf", cpf)
  .order("criado_em", { ascending: false })
```

RLS (`afastamentos_colaborador_read`) enforces CPF scope at the database level. The `.eq("cpf", cpf)` in the query is explicit intent and uses the existing `idx_afastamentos_cpf` index.

Renders:
- Greeting: `configuracoes.portal_saudacao` with `{nome}` → `colaborador_nome` from first row (or "colaborador" if no rows).
- Banner: `configuracoes.portal_banner` as a muted subtitle.
- `DataTable` with columns: **Tipo** (rotulo), **Início**, **Fim**, **Duração** (days), **Situação** (`StatusPill`). Each row links to `/portal/afastamentos/[id]`.
- `EmptyState` when no rows, text from `configuracoes.portal_vazio`.

### 7.2 `/portal/afastamentos/[id]`

Server component. Queries:

```ts
supabase
  .from("afastamentos")
  .select("id, situacao, afastamento_tipos!inner(rotulo), data_inicio, data_fim, duracao, empresas!inner(nome), unidades!inner(nome), colaborador_nome, motivo_rejeicao")
  .eq("id", id)
  .single()
```

RLS returns null if the CPF does not match → `notFound()`. No application-level CPF check needed.

Renders a `FieldGrid` with:
- Tipo de afastamento
- Data de início / Data de fim / Duração
- Empresa / Unidade
- Situação (`StatusPill`)
- Motivo de rejeição — shown only when `situacao === "rejeitado"`

No CID, no INSS/acidente/internação flags, no timeline, no ApprovalBar. Back link to `/portal/painel`.

### 7.3 `/portal/login` and `/portal/cadastro`

Both reuse `AuthCard` (existing component) for visual consistency with the staff login. Different `title`, `lead`, and `pitch` props. No `AppTopNav`.

### 7.4 `/admin/configuracoes`

Extended with three new editable fields for `portal_saudacao`, `portal_vazio`, `portal_banner`. Follows the existing pattern for that page.

## 8. Reused primitives

No new primitives introduced. Reuses from Phase 5 toolbox:
- `DataTable` — afastamento list
- `StatusPill` — situação badge
- `EmptyState` — zero-row state
- `FieldGrid` — detail fields
- `AuthCard` — login and cadastro shells

## 9. Testing

### 9.1 Unit tests

**`tests/unit/portal-auth.test.ts`**
Covers `requireColaborador()`:
- No Supabase session → `{ status: "unauthenticated" }`
- Session exists, no `colaboradores` row → `{ status: "no_profile", user }`
- Session exists, row exists → `{ status: "ok", user, cpf }`

**`tests/unit/portal-cadastro-validation.test.ts`**
Covers the `/api/portal/cadastro` handler logic:
- Valid CPF found in `afastamentos` → 200
- CPF not found → 422
- Malformed CPF (non-numeric, wrong length) → 400

### 9.2 E2E arc (gated Phase 8)

Added to `tests/e2e/happy-path.spec.ts` as a gated arc (same pattern as Phase 6):

1. Sign in programmatically as the seeded colaborador (`colaborador@seed.local`) using Supabase service-role to set a session cookie — bypasses the OTP step in tests.
2. Navigate to `/portal/painel` — assert greeting renders and `DataTable` has ≥ 1 row.
3. Click first row → assert detail page shows `StatusPill`, tipo rotulo, and data_inicio.
4. Assert that no CID label or INSS/acidente text appears on the page.

Existing Phase 6 arc is not modified.

## 10. Success criteria

1. A colaborador with a registered CPF can log in via email OTP and see their own afastamentos — no staff app access.
2. A colaborador whose CPF has no afastamentos on record cannot complete `/portal/cadastro`.
3. Attempting to access `/portal/afastamentos/[id]` belonging to another colaborador returns 404 (RLS blocks the query).
4. Portal copy (greeting, banner, empty state) is editable at `/admin/configuracoes` without a code change.
5. 0 TypeScript errors, all unit tests pass, existing E2E happy-path arcs stay green.

## 11. Out of scope

- Ocorrências in the portal
- Colaborador-initiated edits or cancellations
- Email template changes for portal-related notifications
- SMS OTP
- Multi-tenant

---

> Spec written 2026-05-14. Umbrella spec updated to reflect Phase 8 status.
