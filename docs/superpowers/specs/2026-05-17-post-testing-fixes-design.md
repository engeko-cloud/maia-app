# Post-Testing Fixes — Design Spec
_Date: 2026-05-17_

## Scope

Fixes identified from first full manual test cycle. Four concern areas: route structure, RBAC, bugs, and investigação flow.

---

## 1. Route Restructure

### 1a. `(app)` → `app`

Rename the route group `app/(app)/` to `app/app/`. This makes all admin-app routes live under the `/app/` URL prefix, cleanly separating them from public routes under `/`.

**Before / After:**
| Old URL | New URL |
|---|---|
| `/painel` | `/app/painel` |
| `/afastamentos` | `/app/afastamentos` |
| `/afastamentos/aprovacoes` | `/app/afastamentos/aprovacoes` |
| `/afastamentos/[id]` | `/app/afastamentos/[id]` |
| `/ocorrencias` | `/app/ocorrencias` |
| `/ocorrencias/[id]` | `/app/ocorrencias/[id]` |
| `/ocorrencias/[id]/investigacao` | `/app/ocorrencias/[id]/investigacao` |
| `/admin` | `/app/admin` |

**Public routes are unchanged** — they live in `app/(public)/` and have no `/app/` prefix.

**Files to move:**
```
app/(app)/  →  app/app/
```
All files inside move as-is; only the parent folder is renamed.

### 1b. Flatten `(admin)` group

Currently `app/(app)/(admin)/admin/layout.tsx` wraps the admin subroute in a double group. Remove the `(admin)/` group:
- Move `app/(app)/(admin)/admin/layout.tsx` → `app/app/admin/layout.tsx`
- Delete the now-empty `(admin)/` folder

Result: `app/app/admin/` has its own `layout.tsx` (admin guard) directly inside.

### 1c. Middleware

Replace the list of protected prefixes with a single `/app` check:

```ts
// Before
const protectedPrefixes = ["/painel", "/afastamentos", "/ocorrencias", "/admin"];
const isProtected = protectedPrefixes.some(p => path === p || path.startsWith(p + "/"));
const isPublicEdit = path.startsWith("/afastamentos/editar/");
if (isProtected && !isPublicEdit && !user) redirect("/login");

// After
const isProtected = path.startsWith("/app/");
if (isProtected && !user) redirect("/login");
```

The `isPublicEdit` exception is no longer needed — `/afastamentos/editar/[token]` lives in `(public)` and never starts with `/app/`.

### 1d. Internal link updates

Every `href`, `redirect()`, and hardcoded path inside `app/app/` and `components/` that references an admin-app route must gain the `/app/` prefix. Key locations:

| File | Change |
|---|---|
| `lib/nav.ts` | All `href` values: `/painel` → `/app/painel`, etc. |
| `components/layout/app-nav-row.tsx` | Active-state check for `/painel` |
| `components/layout/app-user-pill.tsx` | Dashboard link |
| `components/layout/public-top-bar.tsx` | "Painel" link |
| `components/layout/public-mobile-menu.tsx` | "Painel" link |
| `components/gates/equipe-only.tsx` | `redirect("/painel")` → `redirect("/app/painel")` |
| `components/saude/saude-banner.tsx` | `/painel/saude` → `/app/painel/saude` |
| `app/app/painel/page.tsx` | All `href` props on QuickAction / PainelHero |
| `app/app/afastamentos/page.tsx` | Breadcrumb + `basePath` |
| `app/app/afastamentos/aprovacoes/page.tsx` | Breadcrumbs |
| `app/app/afastamentos/[id]/page.tsx` | Breadcrumbs |
| `app/app/ocorrencias/page.tsx` | Breadcrumb + `basePath` |
| `app/app/ocorrencias/[id]/page.tsx` | Breadcrumbs |
| `app/app/ocorrencias/[id]/investigacao/page.tsx` | Breadcrumbs |
| `app/app/painel/saude/page.tsx` | `redirect("/painel")` → `redirect("/app/painel")` |
| `app/(app)/layout.tsx` (becomes `app/app/layout.tsx`) | `redirect("/login")` stays; no path change needed |

---

## 2. RBAC

### 2a. Permission model

Two equipe codes: `"oh"` (afastamentos domain) and `"safety"` (ocorrências + investigações domain). Admins access everything. A user can belong to both equipes.

| Capability | Admin | OH | Safety | OH + Safety |
|---|---|---|---|---|
| `/app/afastamentos/*` | ✓ | ✓ | ✗ | ✓ |
| `/app/afastamentos/aprovacoes` | ✓ | ✓ | ✗ | ✓ |
| `/app/ocorrencias/*` | ✓ | ✗ | ✓ | ✓ |
| `/app/ocorrencias/[id]/investigacao` | ✓ | ✗ | ✓ | ✓ |
| `/app/admin/*` | ✓ | ✗ | ✗ | ✗ |

Cross-domain navigation (Safety user goes to `/app/afastamentos/[id]`) → `redirect("/app/painel")` via the `requireEquipe` guard.

### 2b. Current user helper

`app/app/layout.tsx` already fetches `administrador` and `equipe_usuarios`. Extend the query to also fetch `equipes.codigo` so downstream pages can call `isInEquipe(me, 'oh')` without an extra DB round trip.

Extract a reusable `getCurrentUser(): Promise<Me>` function (in `lib/current-user.ts` or `lib/admin-auth.ts`) that returns `Me = { id, administrador, equipes: string[] }`. The layout calls it once; pages in the same request can call it via Next.js request-level cache (`cache: "force-cache"` + tag, or React `cache()`).

### 2c. Detail page guards

`app/app/afastamentos/[id]/page.tsx` — add at the top:
```ts
await requireEquipe("oh"); // redirects to /app/painel if not oh or admin
```

`app/app/ocorrencias/[id]/page.tsx` and `app/app/ocorrencias/[id]/investigacao/page.tsx` — add:
```ts
await requireEquipe("safety");
```

`components/gates/equipe-only.tsx` already implements `requireEquipe`. Update its redirect target from `/painel` to `/app/painel`.

### 2d. Dashboard (painel) — equipe-filtered KPIs and QuickActions

`app/app/painel/page.tsx` fetches `getCurrentUser()` and conditionally queries + renders:

**KPIs:**
- `isInEquipe(me, 'oh')` → query and show "Afastamentos ativos" + "Aprovações pendentes"
- `isInEquipe(me, 'safety')` → query and show "Ocorrências abertas" + "Investigações em aprovação"
- Admin → both sets

**QuickAction cards:**
- OH domain: Aprovações, Afastamentos, Novo afastamento, Nova ocorrência
- Safety domain: Investigações, Ocorrências, Nova ocorrência
- Admin: all cards from both domains

**Hero headline:** For OH, driven by pending approvals. For safety, driven by open ocorrências. Admin sees approvals (existing logic).

### 2e. Top nav — equipe-filtered groups

Add `requiredEquipe?: "oh" | "safety"` to `AppNavGroup` in `lib/nav.ts`. Add Investigações as a sub-item under Ocorrências.

```ts
// lib/nav.ts — updated groups
{
  id: "afastamentos",
  label: "Afastamentos",
  href: "/app/afastamentos",
  requiredEquipe: "oh",         // hidden for safety-only users
  items: [
    { label: "Lista",      href: "/app/afastamentos" },
    { label: "Aprovações", href: "/app/afastamentos/aprovacoes" },
  ],
},
{
  id: "ocorrencias",
  label: "Ocorrências",
  href: "/app/ocorrencias",
  requiredEquipe: "safety",     // hidden for oh-only users
  items: [
    { label: "Lista",          href: "/app/ocorrencias" },
    { label: "Investigações",  href: "/app/ocorrencias?investigacoes=1" }, // or a dedicated list route
  ],
},
{
  id: "admin",
  label: "Admin",
  href: "/app/admin",
  adminOnly: true,
  items: [],
},
```

`AppTopNav` fetches `equipes` alongside `administrador` (one query) and filters groups:
```ts
const groups = appNav.filter(g => {
  if (g.adminOnly && !isAdmin) return false;
  if (g.requiredEquipe) return isInEquipe(me, g.requiredEquipe);
  return true;
});
```

---

## 3. Bug Fixes

### 3a. Base URL — email CTAs broken

All public API routes must resolve the base URL the same way:
```ts
const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "http://localhost:3000";
```

Files to fix:
- `app/api/public/afastamentos/route.ts` — line 61: `APP_URL ?? ""` → standardized pattern
- `app/api/public/ocorrencias/route.ts` — line 118: same

All other routes (`investigacoes/submeter`, PDF, etc.) already use the correct pattern.

### 3b. Fluig — async fire-and-forget

Approval must not be blocked by Fluig latency or failure. Fluig is a downstream sync, not a gate.

**New flow in `app/api/afastamentos/[id]/aprovar/route.ts`:**
1. Validate + update `afastamento.situacao = "finalizado"` (sync, must succeed)
2. Log `aprovado` evento (sync)
3. Send approval email (sync)
4. Return `200` to client
5. Fire Fluig non-blocking:
   ```ts
   void (async () => {
     try {
       const result = await pushToFluig({ ... });
       await writeEvento(admin, { evento: "fluig_enviado", dados: result });
     } catch (err) {
       await writeEvento(admin, { evento: "fluig_erro", dados: { error: String(err) } });
     }
   })();
   ```

**Dev bypass** — inside the async block, before calling `pushToFluig`:
```ts
if (process.env.NODE_ENV !== "production") {
  await writeEvento(admin, { evento: "fluig_enviado", dados: { dev_bypass: true } });
  return;
}
```

The existing Fluig error banner reads from eventos — it continues to work without changes.

### 3c. Form validation — `ultimo_dia_trabalhado`

In the ocorrência submission form, `ultimo_dia_trabalhado` is required only when `houve_vitima === true`. The Zod schema needs a `superRefine` or discriminated union:

```ts
.superRefine((val, ctx) => {
  if (val.houve_vitima && !val.ultimo_dia_trabalhado) {
    ctx.addIssue({ code: "custom", path: ["ultimo_dia_trabalhado"], message: "Obrigatório quando há vítima" });
  }
});
```

The frontend form must also conditionally render the field only when `houve_vitima` is checked.

### 3d. Afastamento `tipo` on auto-create from ocorrência

The inference function in `app/api/public/ocorrencias/route.ts` (lines 14–21) maps:
- `"acidente"` / `"trajeto"` + ≤15 days → `"acidente"` (Acidente de Trabalho) ✓
- `"acidente"` / `"trajeto"` + >15 days → `"prev_91"` ✓
- `"doenca"` / `"incidente"` + ≤15 days → `"doenca"` ✓
- `"doenca"` / `"incidente"` + >15 days → `"prev_31"` ✓
- `"ambiental"` and others → returns `null` (no afastamento created) ✓

The codes match `007_afastamento_tipos.sql`. If wrong tipo was observed in testing, trace: log `o.tipo` and `duracao` at line 14 to verify what the form actually submits. Likely cause: the form sends a display label instead of the code, or `duracao` is 0 because `ultimo_dia_trabalhado` was not set (which is also fixed by 3c).

### 3e. Nav — Investigações sub-item

Add to Ocorrências group in `lib/nav.ts` (see Section 2e above). Target route: the existing investigações list or a filtered view of `/app/ocorrencias?tab=investigacoes`. Confirm the correct target route before implementing.

---

## 4. Investigação Flow

### 4a. Receipt CTA

`investigacaoUrl` is already built in `app/api/public/ocorrencias/route.ts` and passed to the `ocorrencia-receipt` email. The CTA is broken only because `baseUrl = ""`. Fixed entirely by 3a. No other changes needed.

### 4b. Stepper click navigation

`components/detail/stepper.tsx` renders step indicators but has no click handler. Steps should be clickable to jump directly to a completed or current step.

Add `onStepClick?: (index: number) => void` prop to `Stepper`. Render the step `<span>` as a `<button>` when `onStepClick` is provided:
```tsx
<button
  type="button"
  onClick={() => onStepClick?.(i)}
  disabled={!onStepClick}
  aria-label={`Ir para etapa ${s.label}`}
  className={cn("grid size-7 shrink-0 place-items-center rounded-full ...", ...)}
>
```

**In `components/investigacoes/investigacao-form.tsx`** (admin form):
```ts
<Stepper
  current={step}
  steps={...}
  onStepClick={(i) => {
    if (i <= step || gatePassesUpTo(dados, i - 1)) setStep(i);
  }}
/>
```

**In `app/(public)/investigacoes/editar/[token]/form.tsx`** (public form) — same pattern.

Rule: clicking step `i` navigates if `i === 0` OR all gates up to `i - 1` pass (`gatePassesUpTo(dados, i - 1)`). Clicking an unreachable future step does nothing (button is visually enabled but handler guards internally — or disable via `pointer-events-none` on unreachable steps).

---

## Implementation notes

- All DB schema/RLS is already correct in `maia-db/014_rls.sql`. No maia-db changes required for this spec.
- Route rename is a filesystem move + href find-and-replace. No logic changes inside the moved files except the link updates in Section 1d.
- `getCurrentUser()` / `requireEquipe()` already exist in `lib/admin-auth.ts` and `components/gates/equipe-only.tsx`; this spec extends rather than rewrites them.
- The `(public)` route group stays unchanged throughout.
