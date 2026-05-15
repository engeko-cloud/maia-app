# App Shell Rebrand — Design

**Date:** 2026-05-15
**Scope:** Frontend layout chrome across `(public)`, `(auth)`, `(portal-public)`, `(portal)`, `(app)`, `(admin)` route groups.

## Goal

Unify the app shell behind a single MAIA wordmark (no gradient-M avatar), add real dropdown navigation on the public topbar, surface a Portal entry point in the public topbar, replace the public footer with a global sticky footer that ships across all logged-in surfaces, and add "Feito por Fapptory" attribution in the footer and below auth cards.

## Decisions made during brainstorming

- **Brand mark:** drop the gradient-M `LogoMark` everywhere (top bars, auth cards, footer). MAIA wordmark "MAIA · ENGEKO" stays. No `fapptory-mark.svg` in any lockup — only the full `fapptory-logo.svg` wordmark is used, in the Fapptory attribution.
- **Public topbar navigation:** "Início" is a flat link to `/`; "Formulários" and "Sistemas" become dropdowns mirroring the private `AppNavMenu` pattern. Sistemas items are external and open in a new tab.
- **Portal entry on public topbar:** icon-only button (lucide `CircleUserRound`) with `title`/`aria-label` "Portal do colaborador", always visible regardless of staff auth state, linking to `/portal/login`.
- **Portal painel:** keep `PortalLogoutButton` ("Sair" → logout + `/portal/login`). Add `PortalHomeButton` ("Início" → logout + `/`). Both clear the portal session; only destination differs.
- **Sticky footer:** `position: fixed` at viewport bottom, height `h-14`, present on `(public)`, `(app)`, `(admin)`, `(portal)`. Not mounted on `(auth)` / `(portal-public)`.
- **Footer copy (PT-BR):** Left line `MAIA · Gestão de Saúde Ocupacional · Licenciado para ENGEKO`. Right cluster `Feito por [fapptory-logo] · v{APP_VERSION}`. Replaces the current `MAIA · Plataforma de Saúde Ocupacional · © {year} ENGEKO`.
- **Fapptory attribution:** the literal text "Feito por" + `fapptory-logo.svg`, linking to `https://fapptory.me` with `target="_blank" rel="noreferrer noopener"`. Used in two sizes: `sm` (footer) and `md` (centered below auth/portal-public cards).
- **Auth card:** `BrandStamp` keeps the wordmark, drops the M. The duplicate "v{APP_VERSION} · © 2026 ENGEKO" line in the dark brand panel is removed (license/version now lives in the global footer; auth pages get a Fapptory attribution below the card instead).

## Files affected

```
components/brand/
  logo.tsx                      ← simplify to wordmark only
  fapptory-attribution.tsx      ← NEW
  logo-mark.tsx                 ← DELETE (after confirming no remaining imports)

components/layout/
  app-footer.tsx                ← NEW (replaces public-footer.tsx)
  public-footer.tsx             ← DELETE
  public-top-bar.tsx            ← edit (drop M, add Portal icon, dropdown nav via new lib/public-nav.ts)
  public-nav-links.tsx          ← rewrite (anchor links → dropdowns using AppNavMenu)
  public-mobile-menu.tsx        ← edit (collapsible groups inside sheet, Portal entry)
  app-top-nav.tsx               ← edit (via Logo simplification — no other code change)

components/auth/
  auth-card.tsx                 ← edit (drop M from BrandStamp, remove internal copyright line)

components/portal/
  portal-home-button.tsx        ← NEW

lib/
  public-nav.ts                 ← restructure to group/items shape (mirrors lib/nav.ts)

app/
  (public)/layout.tsx           ← mount AppFooter, add bottom padding to wrapper
  (app)/layout.tsx              ← mount AppFooter, add bottom padding to main
  (admin)/layout.tsx            ← mount AppFooter, add bottom padding to main
  (portal)/layout.tsx           ← drop LogoMark, add PortalHomeButton, mount AppFooter, add bottom padding
  (auth)/layout.tsx             ← render FapptoryAttribution size="md" centered below children
  (portal-public)/layout.tsx    ← render FapptoryAttribution size="md" centered below children
```

`fapptory-mark.svg` stays in `/public` (orphaned) — kept for possible future use.

## Component interfaces

### `Logo` (simplified)

```tsx
type LogoSize = "sm" | "md" | "lg";
interface LogoProps {
  size?: LogoSize;
  /** Hides " · ENGEKO" (tight contexts). */
  productOnly?: boolean;
  /** Muted tone (footer). */
  muted?: boolean;
  className?: string;
}
```

Renders `<span>MAIA <span class="accent">·</span> ENGEKO</span>`. No leading mark. Same size mapping as today (`text-sm` / `text-[15px]` / `text-lg`).

### `FapptoryAttribution` (new)

```tsx
interface FapptoryAttributionProps {
  size?: "sm" | "md";
  className?: string;
}
```

Renders:

```tsx
<a
  href="https://fapptory.me"
  target="_blank"
  rel="noreferrer noopener"
  aria-label="Feito por Fapptory (abre em nova aba)"
  className="inline-flex items-center gap-1.5"
>
  <span className="text-xs text-[var(--color-fg-muted)]">Feito por</span>
  <Image src="/fapptory-logo.svg" alt="Fapptory" width={W} height={H} unoptimized />
</a>
```

Sizes (derived from the SVG's 1561:332 aspect ratio):
- `sm`: `height={14}`, `width={66}`
- `md`: `height={18}`, `width={85}`

### `AppFooter` (new)

```tsx
interface AppFooterProps { className?: string }
```

Renders a fixed bottom bar:

```tsx
<footer className="fixed inset-x-0 bottom-0 z-30 h-14 border-t border-border bg-[var(--color-bg-subtle)]">
  <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4 text-xs text-[var(--color-fg-muted)]">
    <span>
      MAIA
      <span aria-hidden="true" className="mx-1">·</span>
      <span className="hidden sm:inline">Gestão de Saúde Ocupacional <span aria-hidden="true" className="mx-1">·</span></span>
      Licenciado para ENGEKO
    </span>
    <span className="inline-flex items-center gap-3">
      <FapptoryAttribution size="sm" />
      <span aria-hidden="true">·</span>
      <span className="font-mono text-[var(--color-fg-subtle)]">v{APP_VERSION}</span>
    </span>
  </div>
</footer>
```

### `PortalHomeButton` (new)

```tsx
"use client";
// Renders <Button variant="ghost" size="sm">Início</Button>
// onClick:
//   await fetch("/api/portal/logout", { method: "POST" });
//   router.push("/");
//   router.refresh();
```

### `lib/public-nav.ts` (restructured)

```ts
export interface PublicNavItem { label: string; href: string; external?: boolean }
export interface PublicNavGroup {
  id: "inicio" | "formularios" | "sistemas";
  label: string;
  href: string;
  items: PublicNavItem[];
}

export const publicNav: PublicNavGroup[] = [
  { id: "inicio", label: "Início", href: "/", items: [] },
  { id: "formularios", label: "Formulários", href: "/forms", items: [
    { label: "Atestados e Declarações", href: "/forms/afastamentos" },
    { label: "Comunicação de Ocorrências", href: "/forms/ocorrencias" },
  ]},
  { id: "sistemas", label: "Sistemas", href: "#", items: [
    { label: "SOC", href: "https://sistema.soc.com.br/WebSoc/", external: true },
    { label: "Obrasoft", href: "https://www.obrasoft.com.br/Acesso/login.aspx", external: true },
    { label: "GreenLegis", href: "https://sistema.greenlegis.com.br/login", external: true },
  ]},
];
```

The landing page `app/(public)/page.tsx` continues to use `publicLinks` from `lib/public-links.ts` (the landing-page card source of truth). `lib/public-nav.ts` **imports `publicLinks` and derives the dropdown items**, so titles and URLs live in exactly one place. Mapping:
- Formulários dropdown ← `publicLinks` group with `title === "Formulários"`, items mapped `{ title, url } → { label: title, href: url }` (no `external` flag).
- Sistemas dropdown ← `publicLinks` group with `title === "Sistemas Externos"`, items mapped `{ title, url } → { label: title, href: url, external: true }`.

Group labels on the topbar are static ("Formulários", "Sistemas") and not derived from `publicLinks` group titles.

### `PublicNavLinks` (rewritten)

- Maps over `publicNav`.
- Empty `items` → plain `<Link href={group.href}>`.
- Non-empty `items` → reuses `AppNavMenu` (currently typed against `AppNavGroup` from `lib/nav.ts`). Implementation step: widen `AppNavMenu`'s prop type to accept any `{ id, label, items: { label, href, external? }[] }` shape (and pass `external` through to render `target="_blank"`). This makes it reusable for both `lib/nav.ts` and `lib/public-nav.ts` consumers without forking the component.
- External items render `target="_blank" rel="noreferrer noopener"` with a trailing `ExternalLink` icon.

### `PublicTopBar` (edited)

Right cluster order: `[PortalIconLink]` → `[Painel → / Sobre]` → `[UserPill / Entrar]`.

```tsx
<Link
  href="/portal/login"
  aria-label="Portal do colaborador"
  title="Portal do colaborador"
  className="rounded-md p-1.5 text-[var(--color-fg-muted)] hover:bg-muted hover:text-foreground"
>
  <CircleUserRoundIcon className="size-5" aria-hidden="true" />
</Link>
```

### `PublicMobileMenu` (edited)

- Sheet contains: Portal entry at the top (Link to `/portal/login`), then a collapsible per `publicNav` group. Collapsibles use native `<details>`/`<summary>` styled with Tailwind to avoid pulling a new primitive. External items show the new-tab icon.
- Bottom CTA (`Painel →` / `Entrar`) unchanged.

### `AuthCard` (edited)

- `BrandStamp` becomes wordmark only (`MAIA · ENGEKO`), no `LogoMark`.
- Remove the `v{APP_VERSION} · © 2026 ENGEKO` line at the bottom of the dark brand panel.

### Layout changes

**`app/(public)/layout.tsx`:** wrapper `<div class="flex min-h-screen flex-col pb-14">`, no longer renders `PublicFooter`, mounts `AppFooter`.

**`app/(app)/layout.tsx`, `app/(admin)/layout.tsx`:** `<main class="mx-auto w-full max-w-6xl px-4 pt-8 pb-24">`, mounts `AppFooter`.

**`app/(portal)/layout.tsx`:**
- Drop `LogoMark` import and the `<LogoMark size="sm" />` element.
- Header keeps the wordmark span: `MAIA · Minha Área`.
- Right side of header gains `<PortalHomeButton />` before `<PortalLogoutButton />`.
- Wrapper `min-h-screen pb-14`; `AppFooter` mounted.

**`app/(auth)/layout.tsx`, `app/(portal-public)/layout.tsx`:**

```tsx
<div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br ... p-4 sm:p-6">
  {children}
  <FapptoryAttribution size="md" />
</div>
```

The card's max width is unchanged; the attribution centers below at viewport width with `gap-6` separation.

## Data flow / state

- `PublicTopBar` is a server component (today). The new Portal icon is rendered unconditionally — no server work added.
- `PortalHomeButton` is a client component that POSTs `/api/portal/logout`, then `router.push("/")` + `router.refresh()`. Network errors are not surfaced to UI; user navigation proceeds regardless.
- Sticky-footer mechanics: each mounting layout adds `pb-14` (footer height) or `pb-24` (footer height + content breathing room) to its main scroll container so content is not occluded.

## Edge cases

- **Z-index:** footer `z-30` sits below sticky headers (`z-40`) and Radix portaled overlays (`z-50`+). Mobile sheet portals at high z — covers footer when open. ✓
- **Mobile viewport:** auth and portal-public layouts do not mount the footer (avoids eating real estate around a centered card). On long form pages in `(app)` / `(portal)`, the `pb-24` on main prevents content occlusion.
- **Narrow viewport:** the footer's middle clause "Gestão de Saúde Ocupacional" is hidden via `hidden sm:inline` so the line fits on phones. Left line falls back to `MAIA · Licenciado para ENGEKO`; right cluster (Feito por + version) is preserved.
- **Fapptory SVG:** rendered via `next/image` with `unoptimized` (Next.js does not optimize SVG by default). Width and height props lock layout. Alt text "Fapptory" degrades gracefully if the file is missing.
- **External Sistemas links:** open in new tab via `target="_blank" rel="noreferrer noopener"`. No analytics, no confirmation.
- **Portal session race:** unaffected. Portal cookie + Supabase staff cookie are independent; `PortalHomeButton` only clears the portal cookie.
- **`LogoMark` deletion safety:** the implementation plan must run a final grep for `LogoMark` and `logo-mark` after editing all consumers, before deleting the file.

## Testing

**Manual smoke (required before commit):**
1. Public `/` — wordmark only in topbar; Início → home; Formulários dropdown → both forms; Sistemas dropdown → 3 external sites in new tabs; Portal icon → `/portal/login`; fixed footer visible; mobile menu (`<md`) lists same items via collapsibles.
2. Auth (`/login`, `/forgot-password`, `/update-password`) — auth card wordmark only; no internal copyright stamp; "Feito por Fapptory" centered below card, opens `fapptory.me` in new tab.
3. Portal-public (`/portal/login`, `/portal/cadastro`) — same Fapptory attribution below card.
4. Portal `/portal/painel` — wordmark "MAIA · Minha Área" (no M); Início (logout + `/`); Sair (logout + `/portal/login`); footer visible.
5. Private (`/painel`, `/afastamentos`, `/ocorrencias`) — wordmark in topbar; footer visible.
6. Admin (`/admin/*`) — same as private.
7. Verify logged-in vs guest state where applicable.

**Automated (light):**
- Unit: render test for `FapptoryAttribution` — asserts `href="https://fapptory.me"`, `target="_blank"`, `rel="noreferrer noopener"`.
- Unit: render test for `Logo` — asserts no `<LogoMark>` descendant.
- E2E: update any existing Playwright selectors that referenced the M mark or anchor-scroll links. No new e2e suites required.

**Static checks:** `npx tsc --noEmit` and `npm run lint` must pass. Compile failure on missed `LogoMark` import is the safety net before deleting the file.

## Out of scope

- Tooltip primitive (using native `title` for the Portal icon).
- Re-skin of cards/inputs/buttons.
- Changes to the landing-page section IDs or `publicLinks` content.
- Analytics on Sistemas external clicks.
- Internationalization beyond the PT-BR strings specified here.
