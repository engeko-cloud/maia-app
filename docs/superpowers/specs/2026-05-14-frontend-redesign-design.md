# MAIA frontend redesign — design spec

**Status:** approved through brainstorming, awaiting user review
**Date:** 2026-05-14
**Repos in scope:** `maia-app` only (frontend). `maia-db` unaffected.

## 1. Problem & goal

The initial rebuild of `maia-app` (Next.js 16, single-tenant for ENGEKO, rebuilt from `old-maia`) shipped functionally but visually inadequate:

- `app/page.tsx` is still the create-next-app starter — no landing page.
- Auth pages use unstyled raw `<input>` elements.
- The private shell is a single bare `TopNav` with text links and no user affordance.
- `/painel` is a plain `<h1>` over a list of links.
- Component vocabulary is impoverished: only 5 shadcn primitives installed; no `card`, `input`, `table`, `dialog`, `dropdown-menu`, `breadcrumb`, etc.
- Quality bar visibly below the original `old-maia` it replaced.

**Goal:** redesign every user-facing surface so the system feels at parity with `old-maia` in design quality, with an ENGEKO-flavored palette and a single-tenant route shape (no `[orgSlug]`). Two distinct shells (public + private). The redesign is structural and visual; backend/data layer remains unchanged.

## 2. Constraints & decisions

- **Single-tenant** — `maia-app` is for ENGEKO only. No `[orgSlug]` segment; no multi-tenant auth flows (no signup, no org-select, no request-org-access).
- **Two shells:** public (anyone, anchors employee form access + external system links) and private (auth-gated, OHS data).
- **Top-nav, not sidebar**, in the private shell — explicit user choice. Old-maia used a sidebar; we are deliberately diverging.
- **Linktree-style root** at `/` (public) — direct parity with old-maia's `[orgSlug]/home` intent.
- **Email/password only** for login — no Google OAuth (explicit user choice).
- **No self-signup** — user accounts are created by admins via `/admin/usuarios` (already exists).
- **Brand placeholder palette:** primary `#0b3a82` (deep ENGEKO blue), accent `#ea580c` (safety orange). All hex values flow from a single CSS variable layer in `app/tokens.css` so the real ENGEKO palette can be swapped in by editing that one file.
- **No real ENGEKO logo asset yet** — use a gradient mark (orange→blue) wordmark "MAIA · ENGEKO" placeholder. Drop-in swap when assets arrive.
- **Fidelity strategy:** inspired-by old-maia, not a direct port. Borrow the quality bar and shadcn vocabulary; design layouts fresh.
- **Existing API routes, supabase helpers, middleware, email templates, and DB schema are out of scope.**

## 3. Information architecture & route map

Two shells under one global root layout. Route groups are transparent in URL.

```
app/
├── layout.tsx                    GLOBAL <html>, fonts, Toaster
├── (public)/                     PUBLIC SHELL
│   ├── layout.tsx                PublicTopBar + PublicFooter, auth-aware
│   ├── page.tsx                  Linktree landing at /
│   ├── forms/
│   │   ├── afastamentos/page.tsx
│   │   └── ocorrencias/page.tsx
│   └── afastamentos/editar/[token]/page.tsx
├── (auth)/                       AUTH SHELL (minimal, centered)
│   ├── layout.tsx
│   ├── login/page.tsx
│   ├── forgot-password/page.tsx
│   └── update-password/page.tsx
├── (app)/                        PRIVATE SHELL (auth-gated)
│   ├── layout.tsx                AppTopNav + supabase auth gate
│   ├── painel/page.tsx
│   ├── afastamentos/
│   │   ├── page.tsx
│   │   ├── aprovacoes/page.tsx
│   │   └── [id]/page.tsx
│   └── ocorrencias/
│       ├── page.tsx
│       └── [id]/
│           ├── page.tsx
│           └── investigacao/page.tsx
├── (admin)/                      PRIVATE + ADMIN SHELL (same AppTopNav)
│   └── admin/…                   (all six CRUD routes already exist)
├── auth/                         server callback routes (existing)
└── api/                          unchanged
```

**Resolution rules:**

- `app/page.tsx` (current Next.js starter) **is deleted**. Root `/` resolves through `app/(public)/page.tsx`.
- The PublicTopBar reads the session and renders `Entrar` CTA when logged out, or `Painel →` link + user pill when logged in. Same `/` page serves both states.
- The private shell guards on `supabase.auth.getUser()` → redirects to `/login`.
- The admin shell additionally checks `usuarios.administrador === true` → redirects non-admins to `/painel`.
- Logo (in any shell) links to `/`. "Painel" link in the private nav goes to `/painel`.

## 4. Design tokens

Replace `app/tokens.css` with a richer surface. Brand variables are separate from semantic surface variables so swapping the real ENGEKO palette is a single-block edit.

```css
:root {
  /* Brand — single source of truth */
  --brand-primary-50:  #eef3fb;
  --brand-primary-100: #d6e1f3;
  --brand-primary-500: #1e3a8a;
  --brand-primary-600: #0b3a82;   /* primary CTA */
  --brand-primary-700: #082b62;
  --brand-primary-900: #04183a;

  --brand-accent-50:   #fff3e8;
  --brand-accent-500:  #ea580c;   /* safety orange */
  --brand-accent-600:  #c2410c;

  /* Surface */
  --color-bg: #ffffff;
  --color-bg-subtle: #f8fafc;
  --color-bg-muted: #f1f5f9;
  --color-fg: #0f172a;
  --color-fg-muted: #475569;
  --color-fg-subtle: #94a3b8;
  --color-border: #e2e8f0;
  --color-border-strong: #cbd5e1;

  --color-primary: var(--brand-primary-600);
  --color-primary-fg: #ffffff;
  --color-primary-hover: var(--brand-primary-700);
  --color-primary-soft: var(--brand-primary-50);

  --color-accent: var(--brand-accent-500);
  --color-accent-fg: #ffffff;
  --color-accent-soft: var(--brand-accent-50);

  --color-success: #16a34a;  --color-success-soft: #dcfce7;
  --color-warning: #d97706;  --color-warning-soft: #fef3c7;
  --color-danger:  #dc2626;  --color-danger-soft:  #fee2e2;
  --color-info:    #2563eb;  --color-info-soft:    #dbeafe;

  --space-1: 4px; --space-2: 8px; --space-3: 12px;
  --space-4: 16px; --space-6: 24px; --space-8: 32px;
  --space-12: 48px; --space-16: 64px;

  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px;
  --radius-xl: 20px; --radius-full: 9999px;

  --shadow-xs: 0 1px 2px rgba(15,23,42,.04);
  --shadow-sm: 0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04);
  --shadow-md: 0 4px 12px -2px rgba(15,23,42,.08);
  --shadow-lg: 0 12px 28px -8px rgba(15,23,42,.12);

  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;

  --text-xs: 12px; --text-sm: 14px; --text-base: 15px;
  --text-lg: 18px; --text-xl: 20px; --text-2xl: 24px;
  --text-3xl: 30px; --text-4xl: 36px;
  --leading-tight: 1.2; --leading-normal: 1.5;
  --tracking-tight: -0.015em;
}

@theme inline {
  --color-background: var(--color-bg);
  --color-foreground: var(--color-fg);
  --color-primary: var(--color-primary);
  --color-primary-foreground: var(--color-primary-fg);
  --color-accent: var(--color-accent);
  --color-accent-foreground: var(--color-accent-fg);
  --color-border: var(--color-border);
  --color-muted: var(--color-bg-muted);
  --color-muted-foreground: var(--color-fg-muted);
  --color-destructive: var(--color-danger);
  --color-ring: var(--color-primary);
  --color-input: var(--color-border);
  --font-sans: var(--font-sans);
  --radius: var(--radius-md);
}
```

Three deliberate decisions captured in this layer:

1. Brand variables are separate from surface variables. Hex swap touches `--brand-*-NN`, nothing else.
2. Accent (`#ea580c` safety-orange) is a real semantic role — used for "pending/urgent" status, CTAs on the public surface, and focal tiles. Distinct from `--color-warning`.
3. Base type is 15px, not 16 — denser, more "tool" than "marketing site".

## 5. Public shell + landing (`/`)

### PublicTopBar

- Brand: gradient mark (orange→blue) + "MAIA · ENGEKO" wordmark (accent-dot separator).
- Three simple links: Início / Formulários / Sistemas. On the landing page they anchor-jump to sections (`#inicio`, `#formularios`, `#sistemas`). On other public pages (`/forms/*`, `/afastamentos/editar/[token]`) they navigate to the landing with a hash (`/#formularios`).
- Right side, auth-aware (server component):
  - Logged out: ghost "Sobre" link + filled "Entrar" CTA.
  - Logged in: ghost "Painel →" link + avatar pill (initials + first name).

### `/` landing — linktree style (faithful to old-maia intent)

- **Hero**: greeting (logged-in personalized) + one-line lead + decorative icon tile.
- **"Atalhos privados"** group (only when logged in): accent-orange-tinted card with one item linking to `/painel`, showing pending counts inline.
- **Formulários** group: card listing public form links (atestados, ocorrências, investigação, relatórios). Each item uses an accent-orange icon chip.
- **Sistemas Externos** group: card listing external apps (SOC, Obrasoft, GreenLegis). Each item uses a primary-blue icon chip, opens in a new tab, marked with an "externo" badge.
- **Footer**: single MAIA mark + copyright + version string.

### PublicFooter

Single line: mark + "MAIA · Plataforma de Saúde Ocupacional · © 2026 ENGEKO" + version on the right. Used by all public routes.

### Data shape

Link groups are typed and live in `lib/public-links.ts`:

```ts
export type PublicLinkType = 'internal' | 'external';
export interface PublicLinkItem {
  title: string;
  description: string;
  url: string;
  icon: string;          // lucide-react icon name
  type: PublicLinkType;
}
export interface PublicLinkGroup {
  title: string;
  items: PublicLinkItem[];
}
export const publicLinks: PublicLinkGroup[] = [ /* … */ ];
```

Seeded with the same items old-maia had hardcoded in its `home/page.tsx`, minus tenant-specific URL prefixes.

## 6. Auth shell + pages

### Layout

`app/(auth)/layout.tsx`: centered viewport, soft gradient backdrop (`#f8fafc → #eef3fb`), no nav.

### `<AuthCard>` shared component

Split-card, `max-width: 720px`:

- **Left panel**: brand-stamp (gradient mark + "MAIA · ENGEKO") at top, page title (h2), lead copy, form children.
- **Right panel**: brand-tinted (ENGEKO blue gradient + accent-orange radial glow in top-right corner + small accent edge details). Pitch heading (with one accent-colored word and an accent underline), pitch sub-copy, version + copyright.

Common visual accents (from approved auth-pages-v2 mockup):

- Orange-tinted radial glow in brand-panel top-right corner.
- Accent underline beneath each pitch heading.
- One accent-orange word per pitch line.
- Accent "·" separator dots in brand-txt and legal.
- Orange-tinted "M" badge on brand-stamp.
- 3px accent edge-line on primary buttons.
- Gradient mark (orange→blue) on the form's brand badge.

### Pages

- **`/login`**: email field, password field with inline "Esqueci a senha" link, primary "Entrar" button. **No Google OAuth, no signup link.**
- **`/forgot-password`**: email field, primary "Enviar link de recuperação", "← Voltar para login" link.
- **`/update-password`**: new-password + confirm fields, primary "Atualizar senha" button.

Brand panel pitch copy varies per page; everything else stays identical.

## 7. Private shell + `/painel`

### AppTopNav

- Sticky `top: 0`, accent-orange 2px underline anchored to the left of the brand.
- Brand: gradient mark + "MAIA · ENGEKO".
- Tabs (server-rendered): `Painel` (anchor link, active state when on /painel), `Afastamentos ▾`, `Ocorrências ▾`, `Admin ▾` (only when `usuarios.administrador === true`).
- Submenus (client component dropdowns via shadcn `DropdownMenu`):
  - **Afastamentos**: Lista · Aprovações · Novo
  - **Ocorrências**: Lista · Investigações · Nova
  - **Admin**: Empresas · Unidades · Equipes · Usuários · Tipos de afastamento · Configurações
- Right side: notification bell icon (with optional accent dot for unread; backend deferred), user pill (avatar + first name + chevron → Perfil/Sair dropdown).

### `/painel` — operational hub

Body layout: page-head + hero banner + 2-column grid.

- **Page-head**: breadcrumb crumb + "Bom dia/Boa tarde, {nome}" greeting + current date on the right.
- **Hero banner**: gradient (blue + orange radial glow) card surfacing the single most urgent metric — e.g., "3 aprovações aguardando sua revisão". Accent-orange edge strip at the bottom.
- **Left column**: 2×2 quick-action grid. First card (urgent flow) uses primary-blue icon chip; others use accent-orange. Optional count pill on the urgent card.
- **Right column**:
  - 2 KPI cards in a row — one primary-blue (e.g., "Afastamentos ativos"), one accent-orange (e.g., "Pend. aprovação"). Each shows label + large value + delta line + colored bottom-edge strip.
  - Recent-activity feed: rows with status dot (orange pending / green approved / blue new) + "{name} — {event}" + relative time. Link to "Ver tudo →".

### Data fetching

Painel page is a server component that runs supabase queries in parallel:

```ts
const [pendentes, recentes, ativos, ocorrenciasAbertas] = await Promise.all([
  supabase.from('afastamentos').select('id', { count: 'exact', head: true }).eq('situacao', 'pendente'),
  supabase.from('eventos').select('id, entity_type, entity_id, tipo, autor_nome, criado_em').order('criado_em', { ascending: false }).limit(5),
  supabase.from('afastamentos').select('id', { count: 'exact', head: true }).in('situacao', ['aprovado','em_andamento']),
  supabase.from('ocorrencias').select('id', { count: 'exact', head: true }).eq('situacao', 'aberta'),
]);
```

The `eventos` table already exists and is used by `lib/eventos.ts` writers and the per-entity `/api/eventos/[entityType]/[entityId]` route. The painel `<ActivityFeed>` reads it directly for cross-entity recent activity.

## 8. List pages

Pattern shared by `/afastamentos`, `/ocorrencias`, `/admin/*`:

- **Page-head**: breadcrumb + h1 + record-count meta + secondary actions (Exportar) + primary action ("＋ Novo X" with accent edge-line).
- **Filter rail**: search input (left) + status chips. Active chip in primary-soft; the "urgent" status chip (Pendentes) uses accent-soft when active. URL search-params drive filter state for shareable links and back-button correctness.
- **`<DataTable>`**: generic table primitive. Columns config maps to row cells; status uses `<StatusPill>`; dates use mono font; row hover; per-row kebab menu via shadcn `DropdownMenu`.
- **Pagination footer**: "Mostrando X de Y" + prev/next.

`/afastamentos/aprovacoes` diverges from the list pattern with a **focused queue layout**:

- Card-per-item with inline Aprovar (green filled) / Rejeitar (red outline) / Ver detalhes buttons.
- Urgent cards (e.g., "vence em 2 dias") get a 3px left accent-orange border + an inline urgency callout.

`<StatusPill>` variants — domain → semantic mapping:

| Domain | Variant | Colors |
|--------|---------|--------|
| Afastamento: `pendente` | `pending` | accent-soft bg, accent fg |
| Afastamento: `aprovado` / `em_andamento` | `approved` | success-soft / success |
| Afastamento: `rejeitado` | `rejected` | danger-soft / danger |
| Afastamento: `rascunho` | `draft` | bg-muted / fg-muted |
| Afastamento: `finalizado` | `success` | success-soft / success |
| Ocorrência: `aberta` | `new` | info-soft / info |
| Ocorrência: `em_investigacao` | `investigating` | info-soft / info |
| Ocorrência: `concluida` | `success` | success-soft / success |

## 9. Detail pages

Pattern shared by `/afastamentos/[id]`, `/ocorrencias/[id]`:

- **`<DetailHeader>`**: breadcrumb + h1 (with mono CPF or ID suffix where relevant) + status-pill row (status + summary + optional urgency callout) + actions slot.
- **Contextual action bar** (renders only when applicable):
  - `<ApprovalBar>` on `/afastamentos/[id]` when `situacao === 'pendente'` AND current user is the approver. Accent-tinted background, inline Rejeitar / Aprovar buttons.
  - `<InvestigationStarter>` on `/ocorrencias/[id]` when `situacao === 'aberta'`.
- **Two-column grid (1.6fr / 1fr)**:
  - **Left**: main info card (`<FieldGrid>` with typed labels) + anexos card (`<AttachmentChip>` per file).
  - **Right**: `<TimelineEvents>` (rewritten from existing `components/eventos-timeline.tsx`) + metadata card.

### `/ocorrencias/[id]/investigacao` — stepped form variant

- Same `<DetailHeader>`, plus `<Stepper>` (Contexto → Causas → Ações corretivas → Conclusão). Done steps show green check; active step uses primary-blue circle + accent-orange bottom underline; pending steps gray.
- Left column hosts the current step's form fields; right column shows the parent ocorrência timeline.
- "Salvar progresso" persists partial state. "Concluir investigação" (only on step 4) finalizes.

## 10. Admin section + public forms (shared with above patterns)

### Admin (`/admin/*`)

- Reuses the private shell (AppTopNav with Admin tab dropdown).
- All six existing routes (`empresas`, `unidades`, `equipes`, `usuarios`, `afastamento-tipos`, `configuracoes`) reuse the list-page pattern via `<CrudTable>` (refactor of existing `components/admin/crud-table.tsx` against the new `<DataTable>`).
- `<CrudTable>` API stays close to current so page-level code changes are minimal.
- `+ Novo X` opens a shadcn `Sheet` side-panel form. Row click opens the same Sheet pre-populated for edit. Delete uses shadcn `Dialog` for confirmation.
- `/admin/configuracoes` is a single-record form, not a table. Stacked `<Card>`s with sections (Notificações, Integrações Fluig, Aprovações).

### Public forms (`/forms/afastamentos`, `/forms/ocorrencias`)

- Wear the public shell (PublicTopBar + PublicFooter).
- **Header card** at the top of the body: brand-tinted info banner explaining what the form is for + "← Voltar ao portal" link.
- **`<Stepper>`** when multi-step (ocorrências has Identificação → Detalhes → Anexos). Afastamentos is single-step.
- **Form body**: narrow single column, shadcn `Form` + `Input` + `Select` + `Textarea` + dropzone for uploads. CPF-lookup affordance (`components/forms/cpf-lookup.tsx`) styled as a card prefix that auto-populates name/unit when a match is found.
- **Submit success**: success page with a "Você receberá um email" callout and the edit-token URL displayed once.
- **`/afastamentos/editar/[token]`** (token-based public edit): same form layout, pre-populated; audit-trail of what changed in a side card.

## 11. Component inventory

### shadcn primitives

Already installed: `button`, `label`, `separator`, `textarea`, `resizable`.

**To install** (via `npx shadcn add …`):
`card`, `input`, `field`, `dropdown-menu`, `avatar`, `badge`, `breadcrumb`, `sheet`, `table`, `form`, `dialog`, `select`, `checkbox`, `radio-group`, `tabs`, `tooltip`, `skeleton`.

`sonner` is already wired in `app/layout.tsx`.

### Custom components in `components/`

```
components/
├── brand/
│   ├── logo.tsx                    NEW — wordmark + gradient mark, sizes sm/md/lg
│   └── logo-mark.tsx               NEW — square mark only
├── layout/
│   ├── public-top-bar.tsx          NEW — server, auth-aware
│   ├── public-footer.tsx           NEW
│   ├── app-top-nav.tsx             REWRITE — replaces components/nav/top-nav.tsx
│   ├── app-nav-menu.tsx            NEW — client dropdown menu
│   ├── app-user-pill.tsx           NEW — avatar + name + dropdown
│   └── app-notification-bell.tsx   NEW (stub, backend deferred)
├── auth/
│   └── auth-card.tsx               NEW — split-card shell
├── home/
│   ├── link-tree.tsx               NEW — server component
│   ├── link-group.tsx              NEW
│   ├── link-item.tsx               NEW — internal (orange) vs external (blue, new-tab)
│   ├── hero-banner.tsx             NEW
│   └── private-shortcuts.tsx       NEW — "Atalhos privados", authed-only
├── painel/
│   ├── painel-hero.tsx             NEW
│   ├── kpi-card.tsx                NEW
│   ├── quick-action.tsx            NEW
│   └── activity-feed.tsx           NEW
├── data/
│   ├── data-table.tsx              NEW — generic table primitive
│   ├── filter-rail.tsx             NEW — URL-state driven
│   ├── status-pill.tsx             NEW
│   └── empty-state.tsx             NEW
├── detail/
│   ├── detail-header.tsx           NEW
│   ├── field-grid.tsx              NEW
│   ├── timeline-events.tsx         REWRITE of components/eventos-timeline.tsx
│   ├── approval-bar.tsx            NEW
│   ├── attachment-chip.tsx         NEW
│   └── stepper.tsx                 NEW
├── afastamentos/                   REWRITE the three existing files
├── ocorrencias/                    NEW (mirror afastamentos folder)
├── admin/
│   └── crud-table.tsx              REWRITE — restyle, keep API
├── forms/                          REWRITE — apply auth-card + stepper + field-grid patterns
└── ui/                             shadcn primitives (auto-managed)
```

### `lib/` additions

```
lib/
├── public-links.ts                 NEW — typed config for landing linktree
├── nav.ts                          NEW — typed config for private top-nav menus
└── supabase/...                    KEEP
```

### Deletions

- `app/page.tsx` (Next.js starter)
- `components/nav/top-nav.tsx`

### Unchanged

- All `app/api/*` routes
- `app/auth/{callback,confirm}/route.ts`
- `lib/supabase/*`
- `middleware.ts`
- `emails/*` (out of scope for this redesign)
- DB schema and migrations (different repo)

## 12. Build phases

Five phases. Each independently testable and shippable.

### Phase 1 — Foundation
**Status:** ✅ Complete (commit range: 05ff84d..210341c)

No user-visible UI yet. Every later phase consumes a stable design layer.

- Replace `app/tokens.css` with the new token surface (Section 4).
- Install all shadcn primitives listed in Section 11.
- Add `lib/public-links.ts` and `lib/nav.ts` configs (typed, seed data from old-maia).
- Build `components/brand/logo.tsx` + `logo-mark.tsx`.
- Add `.superpowers/` to `.gitignore`.
- Verify: `npm run build` passes; existing pages keep their current bare look.

### Phase 2 — Public surface
**Status:** ✅ Complete (commit range: 8d15784..8ea7040)

The surface employees and the world hit. Highest-impact first.

- Build `components/layout/public-top-bar.tsx` + `public-footer.tsx`.
- Build `app/(public)/layout.tsx`.
- Move root: delete `app/page.tsx`, create `app/(public)/page.tsx` (the linktree landing).
- Build `components/home/{link-tree,link-group,link-item,hero-banner,private-shortcuts}.tsx`.
- Verify: `/` renders linktree (logged-out + logged-in states). `/forms/*` and `/afastamentos/editar/[token]` inherit the new public shell automatically.

### Phase 3 — Auth surface
**Status:** ✅ Complete (commit range: 152258d..a05080e)

Polished login funnel.

- Build `app/(auth)/layout.tsx` (centered, gradient backdrop).
- Build `components/auth/auth-card.tsx`.
- Rewrite `app/(auth)/login/page.tsx`, `forgot-password/page.tsx`, `update-password/page.tsx` to use `<AuthCard>`. Email/password only.
- Verify: login → painel; forgot-password email round-trip; update-password from email link.

### Phase 4 — Private app shell + `/painel`
**Status:** ✅ Complete (commit range: 7c26124..bf9a987)

The operational landing.

- Build `components/layout/app-top-nav.tsx` (server, reads session + admin flag) + `app-nav-menu.tsx` + `app-user-pill.tsx` + `app-notification-bell.tsx` (UI stub).
- Rewrite `app/(app)/layout.tsx` and `app/(admin)/layout.tsx` to use the new top-nav. Delete `components/nav/top-nav.tsx`.
- Rewrite `app/(app)/painel/page.tsx` as the operational hub with parallel supabase queries + `<PainelHero>` + `<QuickAction>` grid + `<KpiCard>` row + `<ActivityFeed>`.
- Build the painel components.
- Verify: logged-in users see the new shell + painel; admins see the Admin tab.

### Phase 5 — Operational pages
**Status:** ✅ Complete (commit range: c75bed6..685257c)

Every remaining page reaches the design quality bar.

- Build shared data/detail components: `data-table`, `filter-rail`, `status-pill`, `empty-state`, `detail-header`, `field-grid`, `attachment-chip`, `approval-bar`, `stepper`. Restyle `timeline-events`.
- Rewrite list pages: `/afastamentos`, `/afastamentos/aprovacoes`, `/ocorrencias`.
- Rewrite detail pages: `/afastamentos/[id]`, `/ocorrencias/[id]`, `/ocorrencias/[id]/investigacao`.
- Rewrite admin: restyle `components/admin/crud-table.tsx` against the new `<DataTable>`; verify all six admin routes.
- Rewrite public forms: `/forms/afastamentos`, `/forms/ocorrencias` using the new patterns.
- Verify: existing Playwright happy-path E2E still passes; add one E2E for the public landing.

### Phase ordering rationale

- **Phase 1 first** because every subsequent phase imports those primitives.
- **Phase 2 before Phase 3** because the public landing is the user's top complaint and unblocks "the app has a face" fastest.
- **Phase 3 before Phase 4** because login is the gate to seeing the new private shell.
- **Phase 5 last** because it's the largest surface and benefits from patterns settling in phases 1–4.

## 13. Out of scope

Deliberately deferred to later work:

- Email template redesign (`emails/*`).
- Notification bell backend (UI placeholder ships in Phase 4).
- Real ENGEKO palette hex swap (single-block edit in `tokens.css` once provided).
- Real ENGEKO logo asset (drop SVG into `/public/`, update `<Logo>` to use it).
- Internationalization (Portuguese only for v1, matching old-maia and current state).
- Dark mode (token layer supports it via `@custom-variant dark`, but no theme toggle in v1).

## 14. Success criteria

A user evaluating the redesign should be able to say "this feels at parity with old-maia" because:

1. `/` is a real landing page, not the Next.js starter.
2. Login is a branded split-card, not unstyled inputs.
3. The private shell has a real top-nav with grouped menus and a user affordance.
4. `/painel` is a useful operational hub, not a plain `<h1>` with a list of links.
5. Lists, details, admin, and public forms share a coherent design language with consistent status pills, breadcrumbs, and field-grid patterns.
6. The ENGEKO palette is applied via tokens and can be swapped in a single file when the real palette arrives.
7. The Playwright happy-path E2E still passes end-to-end after each phase.

## 15. Non-goals

- Not a rewrite of the data layer or API.
- Not a port of every old-maia component verbatim (we are reinterpreting, not copying — Section 2).
- Not a multi-tenant restoration (the redesign assumes single-tenant per the existing `DOCUMENTACAO.md`).
- Not a performance optimization pass (token CSS is the only perf-adjacent change).
