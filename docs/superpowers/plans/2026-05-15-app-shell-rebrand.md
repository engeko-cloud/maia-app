# App Shell Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the gradient-M brand mark with a wordmark-only MAIA lockup across every layout, add dropdown navigation + a Portal entry to the public topbar, convert the public footer into a global sticky footer mounted on all logged-in surfaces, and add a "Feito por Fapptory" attribution in the footer and below auth-style cards.

**Architecture:** Three new shared primitives — `FapptoryAttribution`, `AppFooter`, `PortalHomeButton`. The existing `Logo` is collapsed to wordmark-only; `LogoMark` is deleted. `lib/public-nav.ts` is restructured into the same group/items shape as `lib/nav.ts` and derives items from `lib/public-links.ts`. `AppNavMenu` is widened once so both private and public navs reuse it (including external-link rendering for Sistemas). Each layout group mounts the right combo of shell primitives (footer vs. attribution-only).

**Tech Stack:** Next.js 16 (App Router, server components), Tailwind v4, Base UI (`@base-ui/react`) for dropdowns + sheets, lucide-react v1 icons, `next/image` for the Fapptory logo (unoptimized SVG), Vitest 4 (node env) for unit tests.

**Spec:** `docs/superpowers/specs/2026-05-15-app-shell-rebrand-design.md`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `lib/fapptory.ts` | Single source of truth for the Fapptory URL and asset paths |
| Rewrite | `lib/public-nav.ts` | Public topbar nav config (groups with items, derived from `lib/public-links.ts`) |
| Rewrite | `tests/unit/public-nav.test.ts` | Tests the new group/items shape and the derivation from `publicLinks` |
| Create | `tests/unit/fapptory.test.ts` | Asserts the Fapptory URL is `https://fapptory.me` |
| Modify | `components/brand/logo.tsx` | Wordmark only; no `LogoMark` |
| Create | `components/brand/fapptory-attribution.tsx` | "Feito por [fapptory-logo]" link (sm/md sizes) |
| Create | `components/layout/app-footer.tsx` | Fixed-bottom global footer |
| Modify | `components/layout/app-nav-menu.tsx` | Widen props to accept any `{ id, label, items: { label, href, external? }[] }` group |
| Rewrite | `components/layout/public-nav-links.tsx` | Renders groups: flat `<Link>` for empty items, `AppNavMenu` for dropdowns |
| Modify | `components/layout/public-mobile-menu.tsx` | Collapsible groups inside the sheet + Portal entry |
| Modify | `components/layout/public-top-bar.tsx` | Wordmark-only Logo, Portal icon link in right cluster |
| Modify | `components/auth/auth-card.tsx` | Drop `LogoMark` from `BrandStamp`; remove "v… · © 2026 ENGEKO" line from the dark panel |
| Create | `components/portal/portal-home-button.tsx` | Client button: logout + push("/") |
| Modify | `app/(portal)/layout.tsx` | Drop `LogoMark`, mount `PortalHomeButton` next to `PortalLogoutButton`, mount `AppFooter`, add bottom padding |
| Modify | `app/(public)/layout.tsx` | Swap `PublicFooter` → `AppFooter`, add bottom padding |
| Modify | `app/(app)/layout.tsx` | Mount `AppFooter`, change `main` padding to `pt-8 pb-24` |
| Modify | `app/(admin)/layout.tsx` | Mount `AppFooter`, change `main` padding to `pt-8 pb-24` |
| Modify | `app/(auth)/layout.tsx` | Wrap as flex-col, append `FapptoryAttribution size="md"` below children |
| Modify | `app/(portal-public)/layout.tsx` | Same as `(auth)/layout.tsx` |
| Delete | `components/brand/logo-mark.tsx` | No longer used after the rebrand |
| Delete | `components/layout/public-footer.tsx` | Replaced by `app-footer.tsx` |

`fapptory-mark.svg` stays in `/public` (orphaned, kept for possible future use).

---

## Task 1: Fapptory constants module

**Files:**
- Create: `lib/fapptory.ts`
- Test: `tests/unit/fapptory.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/fapptory.test.ts
import { describe, expect, it } from "vitest";
import { FAPPTORY_URL, FAPPTORY_LOGO_SRC } from "@/lib/fapptory";

describe("fapptory constants", () => {
  it("FAPPTORY_URL points to https://fapptory.me", () => {
    expect(FAPPTORY_URL).toBe("https://fapptory.me");
  });

  it("FAPPTORY_LOGO_SRC points to the public asset", () => {
    expect(FAPPTORY_LOGO_SRC).toBe("/fapptory-logo.svg");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npx vitest run tests/unit/fapptory.test.ts
```

Expected: FAIL — module `@/lib/fapptory` not found.

- [ ] **Step 3: Implement the module**

```ts
// lib/fapptory.ts
/**
 * Fapptory attribution constants. Used by `FapptoryAttribution` and any
 * other surface that links to the maker. Single source of truth.
 */
export const FAPPTORY_URL = "https://fapptory.me";
export const FAPPTORY_LOGO_SRC = "/fapptory-logo.svg";

/** Aspect ratio for `next/image` width derivation (SVG viewBox 1561:332). */
export const FAPPTORY_LOGO_ASPECT = 1561 / 332;
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
npx vitest run tests/unit/fapptory.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/fapptory.ts tests/unit/fapptory.test.ts
git commit -m "feat(brand): add Fapptory constants module"
```

---

## Task 2: Restructure `lib/public-nav.ts` to group/items shape

**Files:**
- Rewrite: `lib/public-nav.ts`
- Rewrite: `tests/unit/public-nav.test.ts`

- [ ] **Step 1: Rewrite the unit test for the new shape**

```ts
// tests/unit/public-nav.test.ts
import { describe, expect, it } from "vitest";
import { publicNav, type PublicNavGroup } from "@/lib/public-nav";
import { publicLinks } from "@/lib/public-links";

describe("publicNav", () => {
  it("exports three groups in order: inicio, formularios, sistemas", () => {
    expect(publicNav.map((g: PublicNavGroup) => g.id)).toEqual([
      "inicio",
      "formularios",
      "sistemas",
    ]);
  });

  it("Início is a flat link to '/' with no items", () => {
    const inicio = publicNav.find((g) => g.id === "inicio")!;
    expect(inicio.href).toBe("/");
    expect(inicio.items).toEqual([]);
  });

  it("Formulários dropdown is derived from publicLinks 'Formulários' group", () => {
    const formulariosNav = publicNav.find((g) => g.id === "formularios")!;
    const formulariosSrc = publicLinks.find((g) => g.title === "Formulários")!;
    expect(formulariosNav.items.length).toBe(formulariosSrc.items.length);
    expect(formulariosNav.items.map((i) => i.href)).toEqual(
      formulariosSrc.items.map((i) => i.url),
    );
    for (const item of formulariosNav.items) {
      expect(item.external).toBeFalsy();
    }
  });

  it("Sistemas dropdown is derived from publicLinks 'Sistemas Externos' and marks every item external", () => {
    const sistemasNav = publicNav.find((g) => g.id === "sistemas")!;
    const sistemasSrc = publicLinks.find((g) => g.title === "Sistemas Externos")!;
    expect(sistemasNav.items.length).toBe(sistemasSrc.items.length);
    expect(sistemasNav.items.map((i) => i.href)).toEqual(
      sistemasSrc.items.map((i) => i.url),
    );
    for (const item of sistemasNav.items) {
      expect(item.external).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npx vitest run tests/unit/public-nav.test.ts
```

Expected: FAIL — `publicNav` does not exist (file still exports `publicNavSections`).

- [ ] **Step 3: Rewrite `lib/public-nav.ts`**

```ts
// lib/public-nav.ts
import { publicLinks } from "@/lib/public-links";

export interface PublicNavItem {
  label: string;
  href: string;
  external?: boolean;
}

export interface PublicNavGroup {
  id: "inicio" | "formularios" | "sistemas";
  label: string;
  /** Direct nav target when `items` is empty (Início → "/"); ignored otherwise. */
  href: string;
  items: PublicNavItem[];
}

function deriveItems(groupTitle: string, external: boolean): PublicNavItem[] {
  const src = publicLinks.find((g) => g.title === groupTitle);
  if (!src) return [];
  return src.items.map((i) => ({
    label: i.title,
    href: i.url,
    ...(external ? { external: true } : {}),
  }));
}

export const publicNav: PublicNavGroup[] = [
  { id: "inicio", label: "Início", href: "/", items: [] },
  {
    id: "formularios",
    label: "Formulários",
    href: "/forms",
    items: deriveItems("Formulários", false),
  },
  {
    id: "sistemas",
    label: "Sistemas",
    href: "#",
    items: deriveItems("Sistemas Externos", true),
  },
];
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
npx vitest run tests/unit/public-nav.test.ts
```

Expected: PASS, 4/4.

- [ ] **Step 5: Run the full unit suite to confirm no fallout**

```bash
npx vitest run
```

Expected: all tests pass. (At this moment `PublicNavLinks` and `public-mobile-menu` still import the OLD exports; we expect a TypeScript error if we run `tsc`, but vitest doesn't typecheck so the unit suite stays green. The next tasks fix the callers.)

- [ ] **Step 6: Commit**

```bash
git add lib/public-nav.ts tests/unit/public-nav.test.ts
git commit -m "refactor(nav): restructure publicNav as groups with items derived from publicLinks"
```

---

## Task 3: Simplify `Logo` to wordmark only

**Files:**
- Modify: `components/brand/logo.tsx`

- [ ] **Step 1: Rewrite the component**

```tsx
// components/brand/logo.tsx
import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  size?: LogoSize;
  /** Hides " · ENGEKO" (used in tight contexts). */
  productOnly?: boolean;
  /** Muted tone (footer). */
  muted?: boolean;
  className?: string;
}

const wordmarkSize: Record<LogoSize, string> = {
  sm: "text-sm",
  md: "text-[15px]",
  lg: "text-lg",
};

export function Logo({
  size = "md",
  productOnly = false,
  muted = false,
  className,
}: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-bold tracking-tight",
        muted ? "text-[var(--color-fg-muted)]" : "text-[var(--brand-primary-600)]",
        wordmarkSize[size],
        className,
      )}
    >
      MAIA
      {!productOnly && (
        <>
          <span
            className={cn(
              "mx-1.5 font-bold",
              muted ? "text-[var(--color-fg-subtle)]" : "text-[var(--brand-accent-500)]",
            )}
            aria-hidden="true"
          >
            ·
          </span>
          <span className={cn(muted && "text-[var(--color-fg-muted)]")}>ENGEKO</span>
        </>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Manual smoke (no test for layout-only change)**

Start the dev server (if not already running) and visit `/`. Confirm the topbar shows only "MAIA · ENGEKO" with no leading square mark.

```bash
npm run dev
```

Expected: topbar has no gradient-M box. Footer still has the old M (gets removed in a later task). No console errors.

- [ ] **Step 3: Commit**

```bash
git add components/brand/logo.tsx
git commit -m "refactor(brand): drop LogoMark from Logo — wordmark only"
```

---

## Task 4: Create `FapptoryAttribution` component

**Files:**
- Create: `components/brand/fapptory-attribution.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// components/brand/fapptory-attribution.tsx
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  FAPPTORY_URL,
  FAPPTORY_LOGO_SRC,
  FAPPTORY_LOGO_ASPECT,
} from "@/lib/fapptory";

interface FapptoryAttributionProps {
  /** sm = footer line; md = below auth/portal-public cards. */
  size?: "sm" | "md";
  className?: string;
}

const heights: Record<"sm" | "md", number> = { sm: 14, md: 18 };

export function FapptoryAttribution({
  size = "sm",
  className,
}: FapptoryAttributionProps) {
  const height = heights[size];
  const width = Math.round(height * FAPPTORY_LOGO_ASPECT);
  return (
    <a
      href={FAPPTORY_URL}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Feito por Fapptory (abre em nova aba)"
      className={cn(
        "inline-flex items-center gap-1.5 text-[var(--color-fg-muted)] hover:text-foreground",
        size === "md" && "gap-2",
        className,
      )}
    >
      <span className={size === "md" ? "text-sm" : "text-xs"}>Feito por</span>
      <Image
        src={FAPPTORY_LOGO_SRC}
        alt="Fapptory"
        width={width}
        height={height}
        unoptimized
        priority={false}
      />
    </a>
  );
}
```

- [ ] **Step 2: Manual smoke**

The component is not mounted yet — verified visually in later tasks (16 and 17 for auth/portal-public, 5 for the footer).

- [ ] **Step 3: Run typecheck to catch typos**

```bash
npx tsc --noEmit
```

Expected: no new errors from this file. (Pre-existing errors from `PublicNavLinks` still using `publicNavSections` are acceptable until Task 7 lands.)

- [ ] **Step 4: Commit**

```bash
git add components/brand/fapptory-attribution.tsx
git commit -m "feat(brand): add FapptoryAttribution component"
```

---

## Task 5: Create `AppFooter` (fixed bottom)

**Files:**
- Create: `components/layout/app-footer.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// components/layout/app-footer.tsx
import { FapptoryAttribution } from "@/components/brand/fapptory-attribution";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";

interface AppFooterProps {
  className?: string;
}

export function AppFooter({ className }: AppFooterProps) {
  return (
    <footer
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 h-14 border-t border-border bg-[var(--color-bg-subtle)]",
        className,
      )}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4 text-xs text-[var(--color-fg-muted)]">
        <span className="truncate">
          MAIA
          <span aria-hidden="true" className="mx-1">·</span>
          <span className="hidden sm:inline">
            Gestão de Saúde Ocupacional
            <span aria-hidden="true" className="mx-1">·</span>
          </span>
          Licenciado para ENGEKO
        </span>
        <span className="inline-flex shrink-0 items-center gap-3">
          <FapptoryAttribution size="sm" />
          <span aria-hidden="true">·</span>
          <span className="font-mono text-[var(--color-fg-subtle)]">v{APP_VERSION}</span>
        </span>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Manual smoke**

The footer is not mounted yet — verified visually in Tasks 13-15.

- [ ] **Step 3: Commit**

```bash
git add components/layout/app-footer.tsx
git commit -m "feat(layout): add AppFooter — fixed sticky global footer"
```

---

## Task 6: Widen `AppNavMenu` to accept external items

**Files:**
- Modify: `components/layout/app-nav-menu.tsx`

The existing component accepts `AppNavGroup` from `lib/nav.ts`. We widen its prop type so that any group with `{ id, label, items: { label, href, external? }[] }` works — `PublicNavLinks` can then pass `PublicNavGroup` instances.

- [ ] **Step 1: Edit the component**

```tsx
// components/layout/app-nav-menu.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface AppNavMenuItem {
  label: string;
  href: string;
  external?: boolean;
}

interface AppNavMenuGroup {
  id: string;
  label: string;
  items: AppNavMenuItem[];
}

interface AppNavMenuProps {
  group: AppNavMenuGroup;
  /** True when current pathname starts with the group's `href`. */
  active: boolean;
}

export function AppNavMenu({ group, active }: AppNavMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          "text-[var(--color-fg-muted)] hover:bg-muted hover:text-foreground",
          "data-[popup-open]:bg-muted data-[popup-open]:text-foreground",
          active && "text-foreground",
        )}
      >
        {group.label}
        <ChevronDownIcon className="size-4 opacity-60" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="min-w-[200px]">
        {group.items.map((item) =>
          item.external ? (
            <DropdownMenuItem
              key={item.href}
              render={
                <a href={item.href} target="_blank" rel="noreferrer noopener" />
              }
            >
              <span className="flex w-full items-center justify-between gap-2">
                {item.label}
                <ExternalLinkIcon className="size-3.5 opacity-60" aria-hidden="true" />
              </span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={item.href} render={<Link href={item.href} />}>
              {item.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Confirm the private-side caller still typechecks**

`AppNavRow` in `components/layout/app-nav-row.tsx` passes `AppNavGroup` from `lib/nav.ts`. That type has `{ id, label, href, items: { label, href, icon? }[], adminOnly? }` — which is assignable to the widened `AppNavMenuGroup` (extra props are allowed; the `external` flag is optional and will be `undefined` for private items, which is fine).

```bash
npx tsc --noEmit
```

Expected: no new errors from `app-nav-menu.tsx` or `app-nav-row.tsx`. (Pre-existing errors from `public-nav-links.tsx` are still acceptable here.)

- [ ] **Step 3: Run the existing nav test**

```bash
npx vitest run tests/unit/nav.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/layout/app-nav-menu.tsx
git commit -m "refactor(nav): widen AppNavMenu types to support external dropdown items"
```

---

## Task 7: Rewrite `PublicNavLinks` to render groups

**Files:**
- Rewrite: `components/layout/public-nav-links.tsx`

- [ ] **Step 1: Rewrite the component**

```tsx
// components/layout/public-nav-links.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppNavMenu } from "@/components/layout/app-nav-menu";
import { cn } from "@/lib/utils";
import { publicNav } from "@/lib/public-nav";

interface PublicNavLinksProps {
  className?: string;
}

export function PublicNavLinks({ className }: PublicNavLinksProps) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Navegação principal"
      className={cn("flex items-center gap-1 text-sm", className)}
    >
      {publicNav.map((group) => {
        if (group.items.length === 0) {
          const active = pathname === group.href;
          return (
            <Link
              key={group.id}
              href={group.href}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                active
                  ? "bg-muted text-foreground"
                  : "text-[var(--color-fg-muted)] hover:bg-muted hover:text-foreground",
              )}
            >
              {group.label}
            </Link>
          );
        }
        const active = group.items.some(
          (i) => !i.external && pathname.startsWith(i.href),
        );
        return <AppNavMenu key={group.id} group={group} active={active} />;
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors from this file. `public-mobile-menu.tsx` may still error from importing old exports — Task 8 fixes it.

- [ ] **Step 3: Commit**

```bash
git add components/layout/public-nav-links.tsx
git commit -m "feat(nav): public topbar links render dropdowns for Formulários/Sistemas"
```

---

## Task 8: Update `PublicMobileMenu` for collapsible groups + Portal entry

**Files:**
- Modify: `components/layout/public-mobile-menu.tsx`

- [ ] **Step 1: Rewrite the component**

```tsx
// components/layout/public-mobile-menu.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { MenuIcon, CircleUserRoundIcon, ExternalLinkIcon, ChevronDownIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { publicNav } from "@/lib/public-nav";

interface PublicMobileMenuProps {
  user: { firstName: string } | null;
}

export function PublicMobileMenu({ user }: PublicMobileMenuProps) {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Abrir menu"
            className="md:hidden"
          />
        }
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col gap-4 p-6">
        <SheetHeader className="p-0">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>

        {/* Portal entry — top of the sheet */}
        <Link
          href="/portal/login"
          onClick={close}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <CircleUserRoundIcon className="size-4" aria-hidden="true" />
          Portal do colaborador
        </Link>

        <nav aria-label="Navegação principal" className="flex flex-col gap-1">
          {publicNav.map((group) =>
            group.items.length === 0 ? (
              <Link
                key={group.id}
                href={group.href}
                onClick={close}
                className="rounded-md px-3 py-2 text-base font-medium text-[var(--color-fg-muted)] hover:bg-muted hover:text-foreground"
              >
                {group.label}
              </Link>
            ) : (
              <details key={group.id} className="group">
                <summary
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-base font-medium text-[var(--color-fg-muted)]",
                    "hover:bg-muted hover:text-foreground",
                    "[&::-webkit-details-marker]:hidden",
                  )}
                >
                  {group.label}
                  <ChevronDownIcon
                    className="size-4 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="ml-2 mt-1 flex flex-col gap-0.5 border-l border-border pl-2">
                  {group.items.map((item) =>
                    item.external ? (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={close}
                        className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-[var(--color-fg-muted)] hover:bg-muted hover:text-foreground"
                      >
                        {item.label}
                        <ExternalLinkIcon className="size-3.5 opacity-60" aria-hidden="true" />
                      </a>
                    ) : (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={close}
                        className="rounded-md px-3 py-2 text-sm text-[var(--color-fg-muted)] hover:bg-muted hover:text-foreground"
                      >
                        {item.label}
                      </Link>
                    ),
                  )}
                </div>
              </details>
            ),
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
          {user ? (
            <Link
              href="/painel"
              onClick={close}
              className="rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
            >
              Painel →
            </Link>
          ) : (
            <Link
              href="/login"
              onClick={close}
              className="rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
            >
              Entrar
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors from this file.

- [ ] **Step 3: Manual smoke**

In dev (`npm run dev`), resize the browser below `md` and confirm:
- The menu icon shows in the topbar.
- Opening the sheet shows the Portal entry at top, then Início (flat link), then Formulários / Sistemas as collapsibles.
- External Sistemas items open in a new tab.

- [ ] **Step 4: Commit**

```bash
git add components/layout/public-mobile-menu.tsx
git commit -m "feat(nav): mobile sheet — Portal entry + collapsible Formulários/Sistemas groups"
```

---

## Task 9: Update `PublicTopBar` — drop M, add Portal icon

**Files:**
- Modify: `components/layout/public-top-bar.tsx`

- [ ] **Step 1: Edit the right-cluster JSX**

```tsx
// components/layout/public-top-bar.tsx
import Link from "next/link";
import { CircleUserRoundIcon } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PublicNavLinks } from "@/components/layout/public-nav-links";
import { PublicMobileMenu } from "@/components/layout/public-mobile-menu";

function deriveInitials(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0]!.slice(0, 2).toUpperCase();
  return (tokens[0]![0]! + tokens[tokens.length - 1]![0]!).toUpperCase();
}

export async function PublicTopBar() {
  const supabase = await getSupabaseServer();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  let user: { firstName: string; initials: string } | null = null;
  if (authUser) {
    const { data: row } = await supabase
      .from("usuarios")
      .select("nome")
      .eq("id", authUser.id)
      .single();
    const nome = row?.nome?.trim() ?? "";
    if (nome) {
      const firstName = nome.split(/\s+/)[0]!;
      user = { firstName, initials: deriveInitials(nome) };
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" aria-label="Início" className="shrink-0">
          <Logo size="md" />
        </Link>
        <div className="hidden flex-1 justify-center md:flex">
          <PublicNavLinks />
        </div>
        <div className="ml-auto hidden items-center gap-1.5 md:flex">
          <Link
            href="/portal/login"
            aria-label="Portal do colaborador"
            title="Portal do colaborador"
            className="rounded-md p-1.5 text-[var(--color-fg-muted)] hover:bg-muted hover:text-foreground"
          >
            <CircleUserRoundIcon className="size-5" aria-hidden="true" />
          </Link>
          {user ? (
            <>
              <Link
                href="/painel"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--color-fg-muted)] hover:bg-muted hover:text-foreground"
              >
                Painel →
              </Link>
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-sm">
                <Avatar size="sm">
                  <AvatarFallback className="bg-[var(--brand-primary-600)] text-[10px] text-white">
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{user.firstName}</span>
              </span>
            </>
          ) : (
            <Button render={<Link href="/login" />}>Entrar</Button>
          )}
        </div>
        <PublicMobileMenu user={user ? { firstName: user.firstName } : null} />
      </div>
    </header>
  );
}
```

Note: the old "Sobre" anchor link is removed (Início now goes to `/` directly via `PublicNavLinks`, so a duplicate is unnecessary).

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Manual smoke**

```bash
npm run dev
```

Visit `/` in a desktop viewport (≥ md). Confirm:
- Topbar shows wordmark only (no M square).
- Center: Início / Formulários / Sistemas (dropdowns work).
- Right: Portal icon, then Painel→/UserPill if logged in, or Entrar if guest.
- Portal icon tooltip shows "Portal do colaborador" on hover.
- Clicking Sistemas → SOC opens in a new tab.

- [ ] **Step 4: Commit**

```bash
git add components/layout/public-top-bar.tsx
git commit -m "feat(ui): PublicTopBar — wordmark-only Logo + Portal icon entry"
```

---

## Task 10: Update `AuthCard` — drop M from BrandStamp + remove inline copyright

**Files:**
- Modify: `components/auth/auth-card.tsx`

- [ ] **Step 1: Edit `BrandStamp` and the dark panel**

Replace lines 1-3 (imports) and the `BrandStamp` + dark-panel footer:

```tsx
// components/auth/auth-card.tsx
import * as React from "react";
import Link from "next/link";

export interface AuthCardPitch {
  /** Heading words; the word at `accentIndex` renders in the brand accent color. */
  headingWords: string[];
  /** Zero-based index into headingWords. */
  accentIndex: number;
  /** Sub-copy below the heading. */
  sub: string;
}

interface AuthCardProps {
  /** Form-column heading ("Entrar", "Recuperar senha", "Nova senha"). */
  title: string;
  /** One-line lead under the title. */
  lead: string;
  /** Brand-panel pitch (right side desktop, top banner mobile). */
  pitch: AuthCardPitch;
  children: React.ReactNode;
}

function PitchHeading({ pitch }: { pitch: AuthCardPitch }) {
  return (
    <h2 className="text-xl font-semibold leading-tight">
      {pitch.headingWords.map((word, i) => (
        <React.Fragment key={i}>
          {i > 0 && " "}
          <span
            className={
              i === pitch.accentIndex ? "text-[var(--brand-accent-500)]" : ""
            }
          >
            {word}
          </span>
        </React.Fragment>
      ))}
    </h2>
  );
}

function BrandStamp({ tone }: { tone: "light" | "dark" }) {
  const wordmarkClass =
    tone === "light"
      ? "text-sm font-semibold tracking-tight text-foreground"
      : "text-sm font-semibold tracking-tight text-white";
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <span className={wordmarkClass}>
        MAIA <span className="text-[var(--brand-accent-500)]">·</span> ENGEKO
      </span>
    </Link>
  );
}

export function AuthCard({ title, lead, pitch, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-[720px] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-lg)]">
      <div className="grid grid-cols-1 md:grid-cols-[1.05fr_1fr]">
        {/* Mobile-only brand banner */}
        <div className="relative flex items-center gap-3 bg-gradient-to-br from-[var(--brand-primary-600)] to-[var(--brand-primary-900)] p-5 md:hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at top right, color-mix(in oklab, var(--brand-accent-500) 30%, transparent), transparent 60%)",
            }}
          />
          <div className="relative">
            <BrandStamp tone="dark" />
          </div>
        </div>

        {/* Form panel */}
        <div className="p-6 md:p-8">
          <BrandStamp tone="light" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{lead}</p>
          <div className="mt-6">{children}</div>
        </div>

        {/* Brand panel (desktop only) */}
        <div className="relative hidden flex-col bg-gradient-to-br from-[var(--brand-primary-600)] to-[var(--brand-primary-900)] p-8 text-white md:flex">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at top right, color-mix(in oklab, var(--brand-accent-500) 30%, transparent), transparent 60%)",
            }}
          />
          <div className="relative flex h-full flex-col">
            <PitchHeading pitch={pitch} />
            <div className="mt-3 h-[3px] w-12 bg-[var(--brand-accent-500)]" />
            <p className="mt-4 text-sm text-white/80">{pitch.sub}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Removed: `LogoMark` import, the `<LogoMark size="sm" />` element, the bottom "v… · © 2026 ENGEKO" stamp, the `APP_VERSION` import.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors from this file.

- [ ] **Step 3: Manual smoke**

Visit `/login`. Confirm:
- Auth card shows wordmark only (no M square) on both the light and dark panels.
- No version/copyright stamp in the dark panel.

- [ ] **Step 4: Commit**

```bash
git add components/auth/auth-card.tsx
git commit -m "refactor(auth): drop M mark + internal copyright from AuthCard"
```

---

## Task 11: Add `PortalHomeButton`

**Files:**
- Create: `components/portal/portal-home-button.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/portal/portal-home-button.tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PortalHomeButton() {
  const router = useRouter();

  async function handleClick() {
    try {
      await fetch("/api/portal/logout", { method: "POST" });
    } catch {
      // Even if logout fails (network), we still navigate — the user's intent is to leave.
    }
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick}>
      Início
    </Button>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/portal/portal-home-button.tsx
git commit -m "feat(portal): add PortalHomeButton — logout + redirect to /"
```

---

## Task 12: Update `(portal)` layout — wordmark + Início + footer

**Files:**
- Modify: `app/(portal)/layout.tsx`

- [ ] **Step 1: Rewrite the layout**

```tsx
// app/(portal)/layout.tsx
import { redirect } from "next/navigation";
import { requirePortalSession } from "@/lib/portal-auth";
import { PortalHomeButton } from "@/components/portal/portal-home-button";
import { PortalLogoutButton } from "@/components/portal/portal-logout-button";
import { AppFooter } from "@/components/layout/app-footer";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePortalSession();
  if (!session) redirect("/portal/login");

  return (
    <div className="min-h-screen bg-[var(--color-bg-subtle)] pb-14">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">
              MAIA <span className="text-[var(--brand-accent-500)]">·</span> Minha Área
            </span>
          </div>
          <div className="flex items-center gap-1">
            <PortalHomeButton />
            <PortalLogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-10">{children}</main>
      <AppFooter />
    </div>
  );
}
```

Removed: `LogoMark` import and the `<LogoMark size="sm" />` element.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Manual smoke**

Log in to the portal (`/portal/login` → `/portal/painel`). Confirm:
- Header shows "MAIA · Minha Área" wordmark (no M square).
- Header right side has two ghost buttons: Início, Sair.
- Início logs out and goes to `/`.
- Sair logs out and goes to `/portal/login`.
- Fixed footer is visible at the bottom with the new copy.

- [ ] **Step 4: Commit**

```bash
git add app/\(portal\)/layout.tsx
git commit -m "feat(portal): layout — wordmark, Início button, mount AppFooter"
```

---

## Task 13: Update `(public)` layout — swap footer

**Files:**
- Modify: `app/(public)/layout.tsx`

- [ ] **Step 1: Edit**

```tsx
// app/(public)/layout.tsx
import { PublicTopBar } from "@/components/layout/public-top-bar";
import { AppFooter } from "@/components/layout/app-footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col pb-14">
      <PublicTopBar />
      <main className="flex-1">{children}</main>
      <AppFooter />
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke**

Visit `/`. Confirm:
- Footer is fixed at bottom of viewport (try scrolling — footer stays put).
- Content above footer isn't covered (the `pb-14` wrapper accounts for it).

- [ ] **Step 3: Commit**

```bash
git add app/\(public\)/layout.tsx
git commit -m "feat(public): mount AppFooter (fixed) on (public) layout"
```

---

## Task 14: Update `(app)` layout — mount footer + main padding

**Files:**
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Edit**

```tsx
// app/(app)/layout.tsx
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { AppFooter } from "@/components/layout/app-footer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("usuarios")
    .select("administrador, equipe_usuarios(equipe_id)")
    .eq("id", user.id)
    .single();
  const isStaff =
    profile?.administrador === true ||
    (Array.isArray((profile as { equipe_usuarios?: unknown[] } | null)?.equipe_usuarios) &&
      ((profile as { equipe_usuarios?: unknown[] })!.equipe_usuarios!.length ?? 0) > 0);
  if (!isStaff) redirect("/");

  return (
    <div className="min-h-screen bg-[var(--color-bg-subtle)] pb-14">
      <AppTopNav />
      <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-10">{children}</main>
      <AppFooter />
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke**

Log in as staff. Visit `/painel`, `/afastamentos`, `/ocorrencias`. Confirm fixed footer is visible on each; topbar Logo is wordmark only; content scrolls without being covered.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/layout.tsx
git commit -m "feat(app): mount AppFooter on private layout"
```

---

## Task 15: Update `(admin)` layout — mount footer + main padding

**Files:**
- Modify: `app/(admin)/layout.tsx`

- [ ] **Step 1: Edit**

```tsx
// app/(admin)/layout.tsx
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { AppFooter } from "@/components/layout/app-footer";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: u } = await supabase
    .from("usuarios")
    .select("administrador")
    .eq("id", user.id)
    .single();
  if (!u?.administrador) redirect("/painel");

  return (
    <div className="min-h-screen bg-[var(--color-bg-subtle)] pb-14">
      <AppTopNav />
      <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-10">{children}</main>
      <AppFooter />
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke**

Log in as admin. Visit any `/admin/*` route. Confirm fixed footer visible, topbar wordmark only.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/layout.tsx
git commit -m "feat(admin): mount AppFooter on admin layout"
```

---

## Task 16: Update `(auth)` layout — Fapptory below card

**Files:**
- Modify: `app/(auth)/layout.tsx`

- [ ] **Step 1: Rewrite**

```tsx
// app/(auth)/layout.tsx
import { FapptoryAttribution } from "@/components/brand/fapptory-attribution";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-[var(--color-bg-subtle)] to-[var(--brand-primary-50)] p-4 sm:p-6">
      {children}
      <FapptoryAttribution size="md" />
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke**

Visit `/login`. Confirm:
- Card is still centered.
- "Feito por [Fapptory logo]" sits centered below the card.
- Clicking the logo opens `https://fapptory.me` in a new tab.

Repeat for `/forgot-password` and `/update-password`.

- [ ] **Step 3: Commit**

```bash
git add app/\(auth\)/layout.tsx
git commit -m "feat(auth): add Fapptory attribution below auth card"
```

---

## Task 17: Update `(portal-public)` layout — Fapptory below card

**Files:**
- Modify: `app/(portal-public)/layout.tsx`

- [ ] **Step 1: Rewrite**

```tsx
// app/(portal-public)/layout.tsx
import { FapptoryAttribution } from "@/components/brand/fapptory-attribution";

export default function PortalPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-[var(--color-bg-subtle)] to-[var(--brand-primary-50)] p-4 sm:p-6">
      {children}
      <FapptoryAttribution size="md" />
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke**

Visit `/portal/login`. Confirm Fapptory attribution centered below the login card. Repeat for `/portal/cadastro`.

- [ ] **Step 3: Commit**

```bash
git add app/\(portal-public\)/layout.tsx
git commit -m "feat(portal-public): add Fapptory attribution below auth card"
```

---

## Task 18: Delete `LogoMark`

**Files:**
- Delete: `components/brand/logo-mark.tsx`

- [ ] **Step 1: Confirm there are no remaining imports**

```bash
grep -rn "logo-mark\|LogoMark" /Users/heizen/DEV/maia-app \
  --include="*.tsx" --include="*.ts" 2>/dev/null \
  | grep -v "node_modules\|\.next\|\.git\|/logo-mark.tsx:"
```

Expected: no output. If any line is printed, fix that file before deleting.

- [ ] **Step 2: Delete the file**

```bash
git rm components/brand/logo-mark.tsx
```

- [ ] **Step 3: Typecheck + lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(brand): remove unused LogoMark"
```

---

## Task 19: Delete `PublicFooter`

**Files:**
- Delete: `components/layout/public-footer.tsx`

- [ ] **Step 1: Confirm no remaining imports**

```bash
grep -rn "public-footer\|PublicFooter" /Users/heizen/DEV/maia-app \
  --include="*.tsx" --include="*.ts" 2>/dev/null \
  | grep -v "node_modules\|\.next\|\.git\|/public-footer.tsx:"
```

Expected: no output.

- [ ] **Step 2: Delete the file**

```bash
git rm components/layout/public-footer.tsx
```

- [ ] **Step 3: Typecheck + lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(layout): remove obsolete PublicFooter"
```

---

## Task 20: Final verification + smoke

**Files:** none — verification only.

- [ ] **Step 1: Full unit suite**

```bash
npx vitest run
```

Expected: all tests pass (the suite includes the new `fapptory.test.ts` and the rewritten `public-nav.test.ts`).

- [ ] **Step 2: Typecheck + lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: clean.

- [ ] **Step 3: Manual smoke across all surfaces**

Start the dev server and walk through each surface. Use a desktop viewport for the first pass, then resize to `<md` for the mobile pass.

```bash
npm run dev
```

**Desktop pass:**

1. **`/` (guest)** — Wordmark-only topbar; Início link works; Formulários dropdown lists "Atestados e Declarações" + "Comunicação de Ocorrências" (internal); Sistemas dropdown lists SOC + Obrasoft + GreenLegis (all open in new tab with external-link icon); Portal icon (UserCircle) on the right opens `/portal/login`; "Entrar" button works. Footer is fixed at viewport bottom with the new copy; scroll the page and verify the footer stays put. Click the Fapptory logo in the footer → opens `https://fapptory.me` in a new tab.
2. **`/` (logged-in staff)** — Same topbar but right side shows "Painel →" + UserPill instead of "Entrar". Portal icon still present.
3. **`/login`, `/forgot-password`, `/update-password`** — Auth card wordmark only; no internal "© 2026 ENGEKO"; Fapptory attribution centered below the card.
4. **`/portal/login`, `/portal/cadastro`** — Card centered; Fapptory attribution centered below.
5. **`/portal/painel`** — Header shows "MAIA · Minha Área" wordmark; right side has Início + Sair. Click Início → logged out, lands on `/`. Log back in, click Sair → logged out, lands on `/portal/login`. Footer visible.
6. **`/painel`, `/afastamentos`, `/ocorrencias`** — Topbar wordmark only; existing dropdown nav unchanged; footer visible.
7. **`/admin/*`** — Same as private; footer visible.

**Mobile pass (<md):**

1. **`/`** — Hamburger menu opens the sheet. Top of sheet: Portal entry (CircleUserRound icon + "Portal do colaborador"). Then Início (flat). Then Formulários (collapsible, expands to internal items). Then Sistemas (collapsible, expands to external items, each with new-tab icon). Bottom CTA: Entrar / Painel →. Footer fixed at viewport bottom.
2. **Auth + portal-public** — Card stacks; Fapptory attribution centered below.

- [ ] **Step 4: Commit the verification (optional, if any small fix-ups happened)**

If any cosmetic adjustments were needed (e.g., padding tweaks), commit them:

```bash
git add -p
git commit -m "fix(ui): final polish from manual smoke"
```

Otherwise, no commit — the work is done.

---

## Notes for the implementer

- **TDD discipline applies to data layers only.** This work is mostly layout chrome; the only unit-tested modules are `lib/fapptory.ts` (Task 1) and `lib/public-nav.ts` (Task 2). Component changes are verified by typecheck + manual smoke. Do not add `@testing-library/react` for this work — it is not in the dependency tree and is out of scope.
- **External link icon import.** `lucide-react` exports `ExternalLinkIcon` (v1 naming). If your editor's auto-import surfaces `ExternalLink` instead, that also works — both refer to the same export.
- **Sticky-header vs sticky-footer stacking.** `PublicTopBar` and `AppTopNav` use `z-40`. `AppFooter` uses `z-30`. Radix/Base UI portals (dialogs, dropdowns, sheets) sit above both. Do not raise the footer's z-index — it must sit below modal content.
- **`router.refresh()` after portal logout** is required so the `(public)` server layout (which calls `supabase.auth.getUser()`) re-runs and the right-cluster shows the guest state.
- **`fapptory-mark.svg` is intentionally orphaned in `/public`** — do not delete; reserved for possible future use.
