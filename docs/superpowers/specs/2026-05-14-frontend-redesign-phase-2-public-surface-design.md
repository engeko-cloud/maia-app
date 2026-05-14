# Phase 2 — Public Surface (Design)

**Parent spec:** [`2026-05-14-frontend-redesign-design.md`](./2026-05-14-frontend-redesign-design.md) — sections 3 (shell layout), 5 (public shell + landing), 12 (phase plan).

**Status:** Spec — implementation pending.

**Date:** 2026-05-14.

## 1. Goal

Replace the Next.js starter at `/` with a branded linktree landing under a new `(public)` shell. Public form pages already living at `/forms/afastamentos` and `/forms/ocorrencias` inherit the shell for free.

## 2. Scope

In scope:

- `app/(public)/layout.tsx` — public shell wrapping `PublicTopBar` + main + `PublicFooter`.
- `app/(public)/page.tsx` — linktree landing.
- `components/layout/public-top-bar.tsx` + `public-nav-links.tsx` + `public-mobile-menu.tsx` + `public-footer.tsx`.
- `components/home/linktree-hero.tsx` + `private-shortcuts.tsx` + `link-group.tsx` + `link-item.tsx`.
- `lib/version.ts` + `lib/public-nav.ts`.
- `next.config.ts` — single-line env addition for `NEXT_PUBLIC_APP_VERSION`.
- Delete `app/page.tsx` (Next.js starter).
- Tests: `tests/unit/public-nav.test.ts` + `tests/e2e/public-landing.spec.ts`.

Out of scope:

- Visual refresh of `/forms/afastamentos` and `/forms/ocorrencias` (Phase 5).
- Pending-count queries inside `<PrivateShortcuts>` (Phase 4 wires real numbers).
- `/afastamentos/editar/[token]` route — does not exist yet, not created here.
- Auth shell, private shell, painel, operational pages — Phases 3–5.

## 3. Locked decisions

| Decision | Choice |
|---|---|
| Mobile nav | Right-side `<Sheet>` drawer triggered by hamburger. Same nav links + auth CTA inside. |
| Pending counts in `<PrivateShortcuts>` | Stub now (TODO comment placeholder). Phase 4 wires real counts. |
| Footer version source | `package.json` `version` exposed via `NEXT_PUBLIC_APP_VERSION` in `next.config.ts`, read by `lib/version.ts`. |
| Test coverage | Vitest for logic helpers (`buildHref`, `publicNavSections`). One Playwright smoke for `/`. No component-render tests. |
| Top-bar nav links | Anchor on `/` (`#x`), navigate-to-`/#x` from other public pages. `buildHref(pathname, anchor)` helper, unit-tested. |

## 4. File layout

```
app/
├── page.tsx                          DELETE (Next.js starter)
├── (public)/
│   ├── layout.tsx                    CREATE — PublicTopBar + main + PublicFooter
│   ├── page.tsx                      CREATE — linktree landing
│   └── forms/                        UNCHANGED — inherits new shell
│       ├── afastamentos/page.tsx
│       └── ocorrencias/page.tsx

components/
├── layout/
│   ├── public-top-bar.tsx            CREATE — server, reads session
│   ├── public-nav-links.tsx          CREATE — client, three section links
│   ├── public-mobile-menu.tsx        CREATE — client, Sheet wrapper
│   └── public-footer.tsx             CREATE — server, mark + tagline + version
├── home/
│   ├── linktree-hero.tsx             CREATE — server, greeting + icon tile
│   ├── private-shortcuts.tsx         CREATE — server, conditional /painel card
│   ├── link-group.tsx                CREATE — server, card with title + items
│   └── link-item.tsx                 CREATE — server, single link row

lib/
├── version.ts                        CREATE
└── public-nav.ts                     CREATE — sections + buildHref helper

tests/unit/
└── public-nav.test.ts                CREATE
tests/e2e/
└── public-landing.spec.ts            CREATE

next.config.ts                        MODIFY — add env block
```

Net route count: `-1` (delete `app/page.tsx`) `+1` (create `(public)/page.tsx`) = `0`. Build should still report 35 routes.

## 5. Routing & resolution

- `app/page.tsx` is deleted. `(public)/page.tsx` resolves `/`.
- `(public)/forms/afastamentos/page.tsx` and `(public)/forms/ocorrencias/page.tsx` already exist; they will automatically wear the new `(public)/layout.tsx` shell.
- The `(public)` route group does not appear in URLs (Next.js group convention).

## 6. PublicTopBar

### Anatomy

```
┌─────────────────────────────────────────────────────────────────┐
│ [▦] MAIA·ENGEKO   Início  Formulários  Sistemas    [Sobre][Entrar] │
└─────────────────────────────────────────────────────────────────┘
                                                            (mobile: [≡])
```

### Behavior

- **Brand (left):** `<Logo>` from Phase 1, links to `/`.
- **Section links (center, `md:` and up):** `<PublicNavLinks>` renders three links from `lib/public-nav.ts`. Each link's `href` is computed by `buildHref(usePathname(), section.anchor)`.
- **Right slot (auth-aware):**
  - Logged out: ghost "Sobre" link (`href="#inicio"`) + filled `<Button>` "Entrar" linking to `/login`.
  - Logged in: ghost "Painel →" link (`href="/painel"`) + `<Avatar>` pill showing initials + first name from `usuarios.nome`.
- **Mobile (`< md`):** Hamburger button (icon-only `<Button variant="ghost">`) triggers `<PublicMobileMenu>` — a right-side `<Sheet>` containing the same `<PublicNavLinks>` stacked vertically, followed by the auth CTA block.

### Component split

`PublicTopBar` is the only piece that touches Supabase. It is a server component that:

1. Calls `getSupabaseServer()` and `supabase.auth.getUser()`.
2. If a user exists, fetches `usuarios.nome` (`single()`).
3. Renders the bar layout, passing the resolved `{ nome, firstName } | null` down to the auth-slot JSX and to `<PublicMobileMenu>`.

`PublicNavLinks` is client-only because it needs `usePathname()`. Its props are just `{ orientation: 'horizontal' | 'vertical' }` so the same component renders inside the desktop bar and inside the mobile sheet.

`PublicMobileMenu` is client-only because `<Sheet>` requires a state-backed trigger. It receives `user` and renders the same auth CTA inside the sheet.

## 7. PublicFooter

Single muted line, mounted by the layout:

```
[▦sm]  MAIA · Plataforma de Saúde Ocupacional · © 2026 ENGEKO          v0.1.0
```

- `<LogoMark size="sm" muted />` on the left.
- Tagline centered.
- `APP_VERSION` from `lib/version.ts` on the right.
- On narrow screens the version drops below the tagline (`flex-wrap`).

## 8. Landing page (`/`)

Single `<main className="max-w-3xl mx-auto px-4 py-12 space-y-12">` containing four stacked sections:

```
<section id="inicio">   <LinktreeHero  greeting={...} />
<PrivateShortcuts user={...} />                   ← renders null when user is null
<section id="formularios"> <LinkGroup title="Formulários" items={...} />
<section id="sistemas">    <LinkGroup title="Sistemas Externos" items={...} />
```

### Page composition

`(public)/page.tsx` is the only place that touches `lib/public-links.ts` this phase. Supabase is read twice per request — once here for the hero greeting + private shortcuts, once in `<PublicTopBar>` for the auth slot — which is acceptable since both calls hit the same RSC cache.

1. Reads session via `getSupabaseServer()`.
2. If logged in, fetches `usuarios.nome`, derives `firstName` (first whitespace-separated token).
3. Imports `publicLinks` from `lib/public-links.ts` (already shipped Phase 1).
4. Passes presentational props to the four children. No conditional logic in children beyond what their own props demand.

### Components

**`<LinktreeHero greeting muted? />`** — server, presentational.
- Renders an `<h1>` heading with the greeting and a `<p>` lead beneath it.
- Decorative gradient icon tile to the right (square, `~size-16`, accent-to-primary gradient like `<LogoMark>` but larger; uses one decorative `lucide-react` icon — `Activity`).
- `greeting` is `"Bem-vindo à MAIA"` (logged out) or `"Olá, ${firstName}"` (logged in). The page builds the string; the component renders.

**`<PrivateShortcuts user />`** — server.
- Returns `null` if `user` is `null`.
- Otherwise renders an accent-orange-tinted `<Card>` with a single row linking to `/painel`. Row shape mirrors `<LinkItem>` (icon chip + title + description + trailing chevron), but the trailing slot has `{/* TODO Phase 4: pendências count badge */}`.

**`<LinkGroup title items />`** — server.
- Wraps `<Card>` with `<CardHeader>` for the title and a `<ul>` of `<LinkItem>`s.

**`<LinkItem item />`** — server.
- Resolves `item.icon` (string) to a `lucide-react` component via a local map (`{ "file-text": FileText, "siren": Siren, "external-link": ExternalLink }`). The map covers the seed data in `lib/public-links.ts`. Missing keys fall back to `ExternalLink`.
- Internal items (`item.type === 'internal'`): wrap in `next/link <Link>`. Trailing affordance is a `<ChevronRight>` icon.
- External items (`item.type === 'external'`): plain `<a target="_blank" rel="noopener noreferrer">`. Trailing affordance is an "externo" `<Badge>` + `<ExternalLink>` icon.

## 9. `lib/public-nav.ts`

```ts
export interface PublicNavSection {
  id: "inicio" | "formularios" | "sistemas";
  label: string;
  anchor: `#${string}`;
}

export const publicNavSections: PublicNavSection[] = [
  { id: "inicio",      label: "Início",      anchor: "#inicio" },
  { id: "formularios", label: "Formulários", anchor: "#formularios" },
  { id: "sistemas",    label: "Sistemas",    anchor: "#sistemas" },
];

/**
 * Returns the right href for a public-nav link given the current path.
 * On '/' the anchor is bare so the browser scroll-jumps in place.
 * On any other public path it becomes a navigation to '/' followed by the jump.
 */
export function buildHref(pathname: string, anchor: `#${string}`): string {
  return pathname === "/" ? anchor : `/${anchor}`;
}
```

## 10. `lib/version.ts` and `next.config.ts`

`lib/version.ts`:

```ts
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
```

`next.config.ts` gets a single property added to the existing config object:

```ts
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version,
  },
};
```

Read at build time. Inlined into both server and client bundles. Vercel and `npm run build` both expose `npm_package_version` automatically — no `.env` changes needed.

## 11. Tests

### Unit (`tests/unit/public-nav.test.ts`)

- `buildHref('/', '#formularios')` returns `'#formularios'`.
- `buildHref('/forms/afastamentos', '#formularios')` returns `'/#formularios'`.
- `buildHref('/qualquer', '#inicio')` returns `'/#inicio'`.
- `publicNavSections.map(s => s.id)` equals `['inicio', 'formularios', 'sistemas']`.
- Every section has a matching `anchor` of the form `#<id>`.

Expected count: 5 new passes added to the existing 30 → 35 total.

### E2E (`tests/e2e/public-landing.spec.ts`)

Single Playwright spec:

- `page.goto('/')`.
- Assert brand text `MAIA · ENGEKO` is visible.
- Assert headings `Formulários` and `Sistemas Externos` are visible.
- Assert `Entrar` link is visible (proves the logged-out auth slot rendered).
- Assert the page does not contain `next.svg` (proves the starter is gone).

Local execution requires `npx playwright install chromium` once. The plan documents this as a one-time setup step. CI and Vercel already have Playwright wired (happy-path E2E shipped previously).

## 12. Verification gate

End of Phase 2 is "done" when:

- `npm run build` passes; route count stays at 35.
- `npm run test` reports 35 passing unit tests.
- `npx playwright test public-landing` passes (after Chromium install).
- Manual browser check: `/` renders correctly logged-out and logged-in; `/forms/afastamentos` and `/forms/ocorrencias` show the new shell with no other changes.

## 13. Risks & open items

- **Avatar primitive availability:** `<Avatar>` was installed in Phase 1 (`components/ui/avatar.tsx`). Confirmed.
- **Lucide icon name "siren":** part of the lucide-react export list. The seed config in `lib/public-links.ts` already uses it; no change.
- **Hash-link scroll behavior on initial load with `/#x`:** Next.js App Router handles this natively for in-page anchors after navigation. Acceptable.
- **`<PrivateShortcuts>` query cost in Phase 4:** noted, not a Phase 2 problem.
