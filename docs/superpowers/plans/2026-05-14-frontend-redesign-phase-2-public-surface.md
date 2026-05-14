# Frontend Redesign — Phase 2 (Public Surface) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Next.js starter at `/` with a branded linktree landing under a new `(public)` shell (PublicTopBar + PublicFooter), so the public routes finally have a face.

**Architecture:** A server-only public shell reads the Supabase session once and renders an auth-aware top bar over the linktree landing. Section anchor links are routed through a tiny pure helper that decides between in-page jumps and cross-page navigation. Pending-count slots are stubbed for Phase 4 to wire.

**Tech Stack:** Next.js 16 App Router (route groups), React 19 server components, Tailwind v4, shadcn 4.7 (`base-nova`, `@base-ui/react`), lucide-react, react-hook-form (already in place from Phase 1), Supabase SSR, Vitest, Playwright.

**Parent spec:** `docs/superpowers/specs/2026-05-14-frontend-redesign-phase-2-public-surface-design.md`.

---

## File Layout

```
app/
├── page.tsx                          DELETE (Task 12)
├── (public)/
│   ├── layout.tsx                    CREATE (Task 7)
│   ├── page.tsx                      CREATE (Task 12)
│   └── forms/                        UNCHANGED — inherits new shell
components/
├── layout/
│   ├── public-top-bar.tsx            CREATE (Task 6) — server, reads session
│   ├── public-nav-links.tsx          CREATE (Task 4) — client, usePathname
│   ├── public-mobile-menu.tsx        CREATE (Task 5) — client, Sheet
│   └── public-footer.tsx             CREATE (Task 3) — server
├── home/
│   ├── link-item.tsx                 CREATE (Task 8) — server
│   ├── link-group.tsx                CREATE (Task 9) — server
│   ├── linktree-hero.tsx             CREATE (Task 10) — server
│   └── private-shortcuts.tsx         CREATE (Task 11) — server, conditional
lib/
├── version.ts                        CREATE (Task 1)
└── public-nav.ts                     CREATE (Task 2)
tests/unit/
└── public-nav.test.ts                CREATE (Task 2)
tests/e2e/
└── public-landing.spec.ts            CREATE (Task 13)
next.config.ts                        MODIFY (Task 1)
docs/superpowers/specs/2026-05-14-frontend-redesign-design.md  MODIFY (Task 14)
```

**Conventions established Phase 1:**

- shadcn primitives live in `components/ui/` and re-export from `@base-ui/react/*` (NOT Radix). All used here (`Button`, `Card`, `Avatar`, `Badge`, `Sheet`) were installed in Phase 1.
- Lucide icons use the `Icon` suffix pattern in this codebase: `XIcon`, `ChevronRightIcon` (verified in `components/ui/breadcrumb.tsx`, `dropdown-menu.tsx`).
- Server components by default. Components that need browser APIs declare `"use client"` at the top.
- Tailwind v4 with `@theme inline` in `globals.css` maps CSS vars → utility classes. Use `bg-card`, `text-foreground`, etc. For brand vars not mapped, use bracket syntax: `bg-[var(--brand-accent-500)]`.
- The Tailwind class `text-card-foreground` exists, and `bg-card` exists; `bg-muted`, `text-muted-foreground` exist. Brand var bracket access is the escape hatch.

---

## Task 1: Version utility + next.config env wiring

**Files:**
- Create: `lib/version.ts`
- Modify: `next.config.ts` (entire file)

- [ ] **Step 1.1: Add the env block to `next.config.ts`**

Replace the file content with:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version,
  },
};

export default nextConfig;
```

- [ ] **Step 1.2: Create `lib/version.ts`**

```ts
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
```

- [ ] **Step 1.3: Verify the build still passes**

Run: `npm run build`
Expected: build succeeds; route count unchanged. (You can ignore the noise — we'll re-check the count after Task 12.)

- [ ] **Step 1.4: Commit**

```bash
git add lib/version.ts next.config.ts
git commit -m "feat(app): expose package version via NEXT_PUBLIC_APP_VERSION"
```

---

## Task 2: `lib/public-nav.ts` with TDD

**Files:**
- Create: `lib/public-nav.ts`
- Test:   `tests/unit/public-nav.test.ts`

- [ ] **Step 2.1: Write the failing test**

Create `tests/unit/public-nav.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildHref, publicNavSections } from "@/lib/public-nav";

describe("publicNavSections", () => {
  it("exports the three expected sections in order: inicio, formularios, sistemas", () => {
    expect(publicNavSections.map((s) => s.id)).toEqual([
      "inicio",
      "formularios",
      "sistemas",
    ]);
  });

  it("every section has a label and its anchor matches '#<id>'", () => {
    for (const section of publicNavSections) {
      expect(section.label.trim().length).toBeGreaterThan(0);
      expect(section.anchor).toBe(`#${section.id}`);
    }
  });
});

describe("buildHref", () => {
  it("returns the bare anchor when on '/'", () => {
    expect(buildHref("/", "#formularios")).toBe("#formularios");
  });

  it("returns '/<anchor>' when on a non-root public path", () => {
    expect(buildHref("/forms/afastamentos", "#formularios")).toBe("/#formularios");
  });

  it("returns '/<anchor>' for any non-root path including '#inicio'", () => {
    expect(buildHref("/qualquer/coisa", "#inicio")).toBe("/#inicio");
  });
});
```

- [ ] **Step 2.2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/public-nav.test.ts`
Expected: FAIL — module `@/lib/public-nav` not found.

- [ ] **Step 2.3: Implement the module**

Create `lib/public-nav.ts`:

```ts
/**
 * Top-nav section anchors for the public shell.
 * The landing page (/) renders <section id="..."> for each entry,
 * and the PublicNavLinks component routes through buildHref().
 */

export interface PublicNavSection {
  id: "inicio" | "formularios" | "sistemas";
  label: string;
  anchor: `#${string}`;
}

export const publicNavSections: PublicNavSection[] = [
  { id: "inicio", label: "Início", anchor: "#inicio" },
  { id: "formularios", label: "Formulários", anchor: "#formularios" },
  { id: "sistemas", label: "Sistemas", anchor: "#sistemas" },
];

/**
 * On '/' the anchor is bare so the browser jumps in place.
 * Elsewhere we prefix '/' so the link navigates home first, then jumps.
 */
export function buildHref(pathname: string, anchor: `#${string}`): string {
  return pathname === "/" ? anchor : `/${anchor}`;
}
```

- [ ] **Step 2.4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/public-nav.test.ts`
Expected: PASS — 5 tests passing.

- [ ] **Step 2.5: Commit**

```bash
git add lib/public-nav.ts tests/unit/public-nav.test.ts
git commit -m "feat(lib): typed public-nav sections + buildHref helper"
```

---

## Task 3: `PublicFooter` component

**Files:**
- Create: `components/layout/public-footer.tsx`

- [ ] **Step 3.1: Create the component**

```tsx
import { LogoMark } from "@/components/brand/logo-mark";
import { APP_VERSION } from "@/lib/version";

export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-[var(--color-bg-subtle)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-[var(--color-fg-muted)]">
        <span className="inline-flex items-center gap-2">
          <LogoMark size="sm" muted />
          <span>
            MAIA{" "}
            <span aria-hidden="true" className="mx-1">·</span>
            Plataforma de Saúde Ocupacional
            <span aria-hidden="true" className="mx-1">·</span>
            © {year} ENGEKO
          </span>
        </span>
        <span className="font-mono text-[var(--color-fg-subtle)]">v{APP_VERSION}</span>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3.2: Verify it compiles**

Run: `npm run build`
Expected: PASS. (The component is unused at this point; TypeScript only checks it on next build that imports it. The build still runs all .tsx files for type-check, so an import error here would fail. If it compiles, you're good.)

- [ ] **Step 3.3: Commit**

```bash
git add components/layout/public-footer.tsx
git commit -m "feat(layout): PublicFooter — mark + tagline + version"
```

---

## Task 4: `PublicNavLinks` (client)

**Files:**
- Create: `components/layout/public-nav-links.tsx`

- [ ] **Step 4.1: Create the component**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { buildHref, publicNavSections } from "@/lib/public-nav";

interface PublicNavLinksProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
  /** Called after a link is clicked — used by mobile sheet to close itself. */
  onNavigate?: () => void;
}

export function PublicNavLinks({
  orientation = "horizontal",
  className,
  onNavigate,
}: PublicNavLinksProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Seções da página inicial"
      className={cn(
        orientation === "horizontal"
          ? "flex items-center gap-1 text-sm"
          : "flex flex-col gap-1 text-base",
        className,
      )}
    >
      {publicNavSections.map((section) => (
        <Link
          key={section.id}
          href={buildHref(pathname, section.anchor)}
          onClick={onNavigate}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium text-[var(--color-fg-muted)] transition-colors",
            "hover:bg-muted hover:text-foreground",
            orientation === "vertical" && "py-2",
          )}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4.2: Verify it compiles**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4.3: Commit**

```bash
git add components/layout/public-nav-links.tsx
git commit -m "feat(layout): PublicNavLinks — client, usePathname for hash routing"
```

---

## Task 5: `PublicMobileMenu` (client)

**Files:**
- Create: `components/layout/public-mobile-menu.tsx`

- [ ] **Step 5.1: Create the component**

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { MenuIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PublicNavLinks } from "@/components/layout/public-nav-links";

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
      <SheetContent side="right" className="flex flex-col gap-6 p-6">
        <SheetHeader className="p-0">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <PublicNavLinks orientation="vertical" onNavigate={close} />
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

- [ ] **Step 5.2: Verify it compiles**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5.3: Commit**

```bash
git add components/layout/public-mobile-menu.tsx
git commit -m "feat(layout): PublicMobileMenu — Sheet drawer wrapping PublicNavLinks"
```

---

## Task 6: `PublicTopBar` (server, reads session)

**Files:**
- Create: `components/layout/public-top-bar.tsx`

- [ ] **Step 6.1: Create the component**

```tsx
import Link from "next/link";
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
        <div className="ml-auto hidden items-center gap-2 md:flex">
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
            <>
              <Link
                href="#inicio"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--color-fg-muted)] hover:bg-muted hover:text-foreground"
              >
                Sobre
              </Link>
              <Button render={<Link href="/login" />}>Entrar</Button>
            </>
          )}
        </div>
        <PublicMobileMenu user={user ? { firstName: user.firstName } : null} />
      </div>
    </header>
  );
}
```

- [ ] **Step 6.2: Verify it compiles**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6.3: Commit**

```bash
git add components/layout/public-top-bar.tsx
git commit -m "feat(layout): PublicTopBar — server, auth-aware shell"
```

---

## Task 7: `app/(public)/layout.tsx`

**Files:**
- Create: `app/(public)/layout.tsx`

- [ ] **Step 7.1: Create the layout**

```tsx
import { PublicTopBar } from "@/components/layout/public-top-bar";
import { PublicFooter } from "@/components/layout/public-footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicTopBar />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
```

- [ ] **Step 7.2: Verify it compiles and the existing `/forms/*` routes still render**

Run: `npm run build`
Expected: PASS.

Run: `npm run dev` in a second terminal, visit `http://localhost:3000/forms/afastamentos`.
Expected: the form page renders with the new top bar above it and the footer below. Kill the dev server with Ctrl+C when satisfied.

- [ ] **Step 7.3: Commit**

```bash
git add 'app/(public)/layout.tsx'
git commit -m "feat(app): public layout wraps PublicTopBar + PublicFooter"
```

---

## Task 8: `home/link-item.tsx` (server)

**Files:**
- Create: `components/home/link-item.tsx`

- [ ] **Step 8.1: Create the component**

```tsx
import Link from "next/link";
import {
  ChevronRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  SirenIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { PublicLinkItem } from "@/lib/public-links";

const ICON_MAP: Record<string, LucideIcon> = {
  "file-text": FileTextIcon,
  "siren": SirenIcon,
  "external-link": ExternalLinkIcon,
};

interface LinkItemProps {
  item: PublicLinkItem;
}

export function LinkItem({ item }: LinkItemProps) {
  const Icon = ICON_MAP[item.icon] ?? ExternalLinkIcon;
  const isExternal = item.type === "external";

  const inner = (
    <>
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-lg",
          isExternal
            ? "bg-[var(--brand-primary-50)] text-[var(--brand-primary-600)]"
            : "bg-[var(--brand-accent-50)] text-[var(--brand-accent-600)]",
        )}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">{item.title}</span>
          {isExternal && <Badge variant="secondary">externo</Badge>}
        </span>
        <span className="truncate text-sm text-[var(--color-fg-muted)]">
          {item.description}
        </span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-[var(--color-fg-subtle)]">
        {isExternal ? <ExternalLinkIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
      </span>
    </>
  );

  const baseRow =
    "flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-[var(--color-bg-subtle)]";

  return isExternal ? (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={baseRow}
    >
      {inner}
    </a>
  ) : (
    <Link href={item.url} className={baseRow}>
      {inner}
    </Link>
  );
}
```

- [ ] **Step 8.2: Verify Badge supports `variant="secondary"`**

Run: `grep -n 'variant' components/ui/badge.tsx`
Expected: variants include `secondary`. (If not, use `variant="outline"` instead — both ship with base-nova.)

- [ ] **Step 8.3: Verify the file compiles**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 8.4: Commit**

```bash
git add components/home/link-item.tsx
git commit -m "feat(home): LinkItem — icon chip + title + external/internal affordance"
```

---

## Task 9: `home/link-group.tsx` (server)

**Files:**
- Create: `components/home/link-group.tsx`

- [ ] **Step 9.1: Create the component**

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LinkItem } from "@/components/home/link-item";
import type { PublicLinkGroup } from "@/lib/public-links";

interface LinkGroupProps {
  group: PublicLinkGroup;
}

export function LinkGroup({ group }: LinkGroupProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{group.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-2 pb-2">
        {group.items.map((item) => (
          <LinkItem key={item.url} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 9.2: Verify it compiles**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 9.3: Commit**

```bash
git add components/home/link-group.tsx
git commit -m "feat(home): LinkGroup — Card wrapper for a section of LinkItems"
```

---

## Task 10: `home/linktree-hero.tsx` (server)

**Files:**
- Create: `components/home/linktree-hero.tsx`

- [ ] **Step 10.1: Create the component**

```tsx
import { ActivityIcon } from "lucide-react";

interface LinktreeHeroProps {
  greeting: string;
  lead: string;
}

export function LinktreeHero({ greeting, lead }: LinktreeHeroProps) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {greeting}
        </h1>
        <p className="max-w-md text-[var(--color-fg-muted)]">{lead}</p>
      </div>
      <div
        aria-hidden="true"
        className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--brand-accent-500)_0%,var(--brand-primary-600)_100%)] text-white shadow-lg"
      >
        <ActivityIcon className="size-8" />
      </div>
    </div>
  );
}
```

- [ ] **Step 10.2: Verify it compiles**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 10.3: Commit**

```bash
git add components/home/linktree-hero.tsx
git commit -m "feat(home): LinktreeHero — greeting, lead, gradient icon tile"
```

---

## Task 11: `home/private-shortcuts.tsx` (server)

**Files:**
- Create: `components/home/private-shortcuts.tsx`

- [ ] **Step 11.1: Create the component**

```tsx
import Link from "next/link";
import { ChevronRightIcon, LayoutDashboardIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface PrivateShortcutsProps {
  user: { firstName: string } | null;
}

export function PrivateShortcuts({ user }: PrivateShortcutsProps) {
  if (!user) return null;

  return (
    <Card className="ring-[var(--brand-accent-500)]/30 bg-[var(--brand-accent-50)]/40">
      <CardHeader>
        <CardTitle>Atalhos privados</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-2 pb-2">
        <Link
          href="/painel"
          className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-white/50"
        >
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--brand-accent-500)] text-white"
          >
            <LayoutDashboardIcon className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium text-foreground">Painel →</span>
            <span className="text-sm text-[var(--color-fg-muted)]">
              Sua visão operacional do dia.
            </span>
          </span>
          {/* Phase 4 will replace this slot with a pendências count badge. */}
          <span aria-hidden="true" className="shrink-0 text-[var(--color-fg-subtle)]">
            <ChevronRightIcon className="size-4" />
          </span>
        </Link>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 11.2: Verify it compiles**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 11.3: Commit**

```bash
git add components/home/private-shortcuts.tsx
git commit -m "feat(home): PrivateShortcuts — conditional /painel card, count slot stubbed"
```

---

## Task 12: Landing page + delete Next.js starter

**Files:**
- Delete: `app/page.tsx`
- Create: `app/(public)/page.tsx`

- [ ] **Step 12.1: Delete the starter**

```bash
git rm app/page.tsx
```

- [ ] **Step 12.2: Create the landing**

Create `app/(public)/page.tsx`:

```tsx
import { getSupabaseServer } from "@/lib/supabase/server";
import { publicLinks } from "@/lib/public-links";
import { LinktreeHero } from "@/components/home/linktree-hero";
import { PrivateShortcuts } from "@/components/home/private-shortcuts";
import { LinkGroup } from "@/components/home/link-group";

export default async function PublicLanding() {
  const supabase = await getSupabaseServer();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  let user: { firstName: string } | null = null;
  if (authUser) {
    const { data: row } = await supabase
      .from("usuarios")
      .select("nome")
      .eq("id", authUser.id)
      .single();
    const nome = row?.nome?.trim();
    if (nome) {
      user = { firstName: nome.split(/\s+/)[0]! };
    }
  }

  const greeting = user ? `Olá, ${user.firstName}` : "Bem-vindo à MAIA";
  const lead = user
    ? "Atalhos rápidos, formulários e sistemas auxiliares."
    : "Formulários públicos e sistemas auxiliares para colaboradores ENGEKO.";

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-12">
      <section id="inicio">
        <LinktreeHero greeting={greeting} lead={lead} />
      </section>

      <PrivateShortcuts user={user} />

      {publicLinks.map((group) => (
        <section
          key={group.title}
          id={group.title === "Formulários" ? "formularios" : "sistemas"}
        >
          <LinkGroup group={group} />
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 12.3: Verify the build still has the expected route count**

Run: `npm run build`
Expected: PASS. Route count for `/` is now resolved by `app/(public)/page.tsx`. Total route count delta should be zero compared to before Task 12 started (−1 starter, +1 landing).

- [ ] **Step 12.4: Manual browser smoke**

Run: `npm run dev`, visit:
- `http://localhost:3000/` — should show the new linktree (Formulários + Sistemas Externos groups, hero, footer). No Next.js starter visible.
- `http://localhost:3000/forms/afastamentos` — same shell, form below.

Kill the dev server (Ctrl+C).

- [ ] **Step 12.5: Commit**

```bash
git add 'app/(public)/page.tsx'
git commit -m "feat(app): linktree landing replaces Next.js starter"
```

---

## Task 13: Playwright smoke for `/`

**Files:**
- Create: `tests/e2e/public-landing.spec.ts`

- [ ] **Step 13.1: Write the test**

```ts
import { test, expect } from "@playwright/test";

test("public landing shows linktree groups and Entrar CTA", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Bem-vindo à MAIA|Olá/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Formulários" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sistemas Externos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();

  const nextSvg = page.locator('img[src="/next.svg"]');
  await expect(nextSvg).toHaveCount(0);
});
```

- [ ] **Step 13.2: Install Chromium if needed (one-time)**

Run: `npx playwright install chromium`
Expected: Chromium downloaded. (If you've installed it before for the happy-path E2E, this is a no-op.)

- [ ] **Step 13.3: Run the test**

Run: `npx playwright test public-landing`
Expected: PASS. The test starts a dev server, visits `/`, asserts the four elements, asserts the starter image is absent.

If Playwright is not configured to start the dev server automatically, start it manually in a second terminal (`npm run dev`) before running the test, then stop it after.

- [ ] **Step 13.4: Commit**

```bash
git add tests/e2e/public-landing.spec.ts
git commit -m "test(e2e): smoke for public landing"
```

---

## Task 14: Mark Phase 2 complete in parent spec

**Files:**
- Modify: `docs/superpowers/specs/2026-05-14-frontend-redesign-design.md`

- [ ] **Step 14.1: Capture the commit range**

Run: `git log --oneline <first-task-1-commit-sha>..HEAD --reverse | head -1` to get the first Phase 2 commit SHA, and `git rev-parse --short HEAD` to get the last.

You'll need both short SHAs for the spec update. Example placeholder: `<first>..<last>`.

- [ ] **Step 14.2: Update the spec**

Open `docs/superpowers/specs/2026-05-14-frontend-redesign-design.md`, find the line under the Phase 2 header (line ~441):

```
### Phase 2 — Public surface
```

Add immediately beneath it:

```
**Status:** ✅ Complete (commit range: <first>..<last>)
```

Replacing `<first>..<last>` with the SHAs captured above. Match the formatting used for Phase 1 elsewhere in the doc (search for "Status: ✅ Complete" to find the existing pattern).

- [ ] **Step 14.3: Run the final verification gate**

Run all three in sequence:

1. `npm run build` → PASS, route count stable.
2. `npx vitest run` → PASS, 35 tests (30 from Phase 1 + 5 new from `public-nav.test.ts`).
3. `npx playwright test` → PASS, both `happy-path` and `public-landing` (if Chromium is installed).

If any step fails, fix the root cause before continuing. Do not commit broken state.

- [ ] **Step 14.4: Commit**

```bash
git add docs/superpowers/specs/2026-05-14-frontend-redesign-design.md
git commit -m "docs(spec): mark Phase 2 (Public Surface) complete"
```

---

## Verification gate (end of phase)

After Task 14, the following must be true:

- `npm run build` passes; route count for `/` resolves through `app/(public)/page.tsx`.
- `npx vitest run` reports 35 passing tests.
- `npx playwright test` runs both happy-path and public-landing specs (Chromium installed).
- Manual: `/` renders the new linktree logged-out (no PrivateShortcuts card) and logged-in (PrivateShortcuts visible with `/painel` row). `/forms/afastamentos` and `/forms/ocorrencias` show the new shell unchanged below the bar.
- `app/page.tsx` no longer exists in the tree.

## Notes for the implementer

- The pattern for `<Button render={<Link href="..." />}>` is base-nova's "render prop": the button styling is applied to a Next.js `<Link>` so the navigation works without a click handler. This was used in Phase 1 brand components — search `grep -rn "render=" components/` for examples.
- Tailwind v4 bracket access (`bg-[var(--brand-accent-500)]`) sidesteps the `@theme inline` map when no mapped utility exists. Don't add new utilities to `globals.css` for one-off colors — use brackets.
- Do not introduce new shadcn primitives in this phase. Everything you need (`Card`, `Avatar`, `Badge`, `Sheet`, `Button`) was installed in Phase 1.
- The base-nova Sheet primitive uses `@base-ui/react/dialog` under the hood (verified in `components/ui/sheet.tsx`). `open`/`onOpenChange` are standard base-ui Dialog props.
- The Supabase server client is async — always `await getSupabaseServer()`.
