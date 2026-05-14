# Frontend Redesign — Phase 4 (Private App Shell + Painel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare `TopNav` and starter-style `/painel` with a real private shell: a sticky `<AppTopNav>` (brand + grouped dropdown tabs + notification bell + user pill with sign-out) used by both `(app)` and `(admin)` route groups, and a redesigned `/painel` operational hub composed of `<PainelHero>` + 2×2 `<QuickAction>` grid + two `<KpiCard>`s + `<ActivityFeed>`.

**Architecture:** Pure helpers land first (greeting + eventos-format) so they can be unit-tested in isolation. Layout primitives (`<AppNavMenu>`, `<AppUserPill>`, `<AppNotificationBell>`) are client components; the orchestrating `<AppTopNav>` is a server component that reads session + admin flag and filters `appNav` from `lib/nav.ts`. The two layouts (`(app)/layout.tsx`, `(admin)/layout.tsx`) become near-identical wrappers around `<AppTopNav>`, with admin adding an admin-gate check; the old `components/nav/top-nav.tsx` is deleted. The painel page becomes a server component running four supabase queries in parallel, then composing the hero + quick-action grid + KPI row + activity feed.

**Tech Stack:** Next.js 16 App Router (route groups, server actions), React 19 server components, Tailwind v4, shadcn 4.7 (`base-nova`, `@base-ui/react`) — Avatar, Badge, Button, DropdownMenu installed in Phase 1; lucide-react icons; date-fns + `date-fns/locale/pt-BR` for relative time; Supabase JS (`@supabase/ssr`) for server queries and browser sign-out; Vitest for pure helpers; Playwright for the logged-in render-smoke.

**Parent spec:** `docs/superpowers/specs/2026-05-14-frontend-redesign-design.md` (Section 7: Private shell + `/painel`; Section 11: component inventory; Section 12: Phase 4).

---

## File Layout

```
app/
├── (app)/
│   ├── layout.tsx                       REWRITE (Task 6)
│   └── painel/page.tsx                  REWRITE (Task 10)
└── (admin)/
    └── layout.tsx                       REWRITE (Task 6)
components/
├── layout/
│   ├── app-top-nav.tsx                  CREATE — server (Task 5)
│   ├── app-nav-menu.tsx                 CREATE — client (Task 2)
│   ├── app-user-pill.tsx                CREATE — client (Task 3)
│   └── app-notification-bell.tsx        CREATE — client stub (Task 4)
├── painel/
│   ├── painel-hero.tsx                  CREATE — server (Task 8)
│   ├── kpi-card.tsx                     CREATE — server (Task 7)
│   ├── quick-action.tsx                 CREATE — server (Task 7)
│   └── activity-feed.tsx                CREATE — server (Task 9)
└── nav/
    └── top-nav.tsx                      DELETE (Task 6)
lib/
├── greeting.ts                          CREATE (Task 1)
└── eventos-format.ts                    CREATE (Task 1)
tests/
├── unit/
│   ├── greeting.test.ts                 CREATE (Task 1)
│   └── eventos-format.test.ts           CREATE (Task 1)
└── e2e/
    └── painel.spec.ts                   CREATE (Task 11)
docs/superpowers/specs/2026-05-14-frontend-redesign-design.md  MODIFY (Task 12)
```

**Conventions established by prior phases (do not re-litigate):**

- shadcn primitives live in `components/ui/` and re-export from `@base-ui/react/*`. `Avatar`, `Badge`, `Button`, `Card`, `DropdownMenu` are installed.
- Server components by default. Components owning state or event handlers declare `"use client"` at the top of the file.
- Tailwind v4 with `@theme inline` block in `app/globals.css`. Form controls use the standard scale (`--radius-sm: 6px`, `--radius-md: 8px`, `--radius-lg: 12px`). Cards use `rounded-[var(--radius-xl)]` which reads `--radius-xl: 20px` directly from `app/tokens.css :root`.
- For brand variables not mapped to Tailwind utilities (e.g., `--brand-accent-500`, `--brand-primary-600`), use bracket syntax: `bg-[var(--brand-accent-500)]`.
- The `cn` helper lives at `@/lib/utils`.
- Server-side Supabase is `getSupabaseServer()` from `@/lib/supabase/server`; browser-side is `getSupabaseBrowser()` from `@/lib/supabase/client`.
- `appNav` config + types live in `lib/nav.ts` (unchanged in this phase).
- `<LogoMark>` from `@/components/brand/logo-mark` and `<Logo>` from `@/components/brand/logo` accept `size?: "sm" | "md" | "lg"`.
- **Radius preference:** standard Tailwind scale (resolved by the @theme block). No `rounded-full` on rectangular accent bars / dividers; reserve `rounded-full` for true circles (avatars, status dots, count pills, notification bell badge).

**Real `eventos` table schema (verified against `lib/eventos.ts` and `app/api/eventos/[entityType]/[entityId]/route.ts`):**

| Column | Notes |
| --- | --- |
| `id` | uuid |
| `tipo_entidade` | enum: `"afastamento" \| "ocorrencia" \| "investigacao"` |
| `entidade_id` | uuid FK |
| `evento` | enum: `"criado" \| "rejeitado" \| "resubmetido" \| "aprovado" \| "fluig_enviado" \| "fluig_erro" \| "email_enviado" \| "cancelado"` |
| `dados` | jsonb |
| `autor_id` | uuid FK → `usuarios` (nullable) |
| `ocorrido_em` | timestamptz (sort key) |

The parent spec section 7 uses placeholder field names (`entity_type`, `entity_id`, `tipo`, `criado_em`); this plan uses the **actual** column names above for all queries and types.

---

## Task 1: pure helpers — `greeting.ts` + `eventos-format.ts` (with tests)

**Files:**
- Create: `lib/greeting.ts`
- Create: `lib/eventos-format.ts`
- Create: `tests/unit/greeting.test.ts`
- Create: `tests/unit/eventos-format.test.ts`

- [ ] **Step 1.1: Write the failing test for `greeting.ts`**

Create `tests/unit/greeting.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { greetingFor } from "@/lib/greeting";

describe("greetingFor", () => {
  it("returns 'Bom dia' for hours 0-11", () => {
    expect(greetingFor(0)).toBe("Bom dia");
    expect(greetingFor(5)).toBe("Bom dia");
    expect(greetingFor(11)).toBe("Bom dia");
  });

  it("returns 'Boa tarde' for hours 12-17", () => {
    expect(greetingFor(12)).toBe("Boa tarde");
    expect(greetingFor(15)).toBe("Boa tarde");
    expect(greetingFor(17)).toBe("Boa tarde");
  });

  it("returns 'Boa noite' for hours 18-23", () => {
    expect(greetingFor(18)).toBe("Boa noite");
    expect(greetingFor(20)).toBe("Boa noite");
    expect(greetingFor(23)).toBe("Boa noite");
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `npx vitest run tests/unit/greeting.test.ts`
Expected: FAIL with module-resolution error or "greetingFor is not a function".

- [ ] **Step 1.3: Implement `lib/greeting.ts`**

```ts
export type Greeting = "Bom dia" | "Boa tarde" | "Boa noite";

export function greetingFor(hour: number): Greeting {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `npx vitest run tests/unit/greeting.test.ts`
Expected: PASS — 3/3.

- [ ] **Step 1.5: Write the failing test for `eventos-format.ts`**

Create `tests/unit/eventos-format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  formatEventoVerb,
  formatEntidadeNoun,
  eventoDotTone,
} from "@/lib/eventos-format";

describe("formatEventoVerb", () => {
  it("maps each evento to a PT-BR verb", () => {
    expect(formatEventoVerb("criado")).toBe("criou");
    expect(formatEventoVerb("aprovado")).toBe("aprovou");
    expect(formatEventoVerb("rejeitado")).toBe("rejeitou");
    expect(formatEventoVerb("resubmetido")).toBe("resubmeteu");
    expect(formatEventoVerb("cancelado")).toBe("cancelou");
    expect(formatEventoVerb("fluig_enviado")).toBe("enviou ao Fluig");
    expect(formatEventoVerb("fluig_erro")).toBe("falhou no Fluig");
    expect(formatEventoVerb("email_enviado")).toBe("enviou email");
  });
});

describe("formatEntidadeNoun", () => {
  it("maps each tipo_entidade to a PT-BR noun", () => {
    expect(formatEntidadeNoun("afastamento")).toBe("afastamento");
    expect(formatEntidadeNoun("ocorrencia")).toBe("ocorrência");
    expect(formatEntidadeNoun("investigacao")).toBe("investigação");
  });
});

describe("eventoDotTone", () => {
  it("returns 'approved' for aprovado", () => {
    expect(eventoDotTone("aprovado")).toBe("approved");
  });
  it("returns 'rejected' for rejeitado and cancelado", () => {
    expect(eventoDotTone("rejeitado")).toBe("rejected");
    expect(eventoDotTone("cancelado")).toBe("rejected");
  });
  it("returns 'new' for criado and resubmetido", () => {
    expect(eventoDotTone("criado")).toBe("new");
    expect(eventoDotTone("resubmetido")).toBe("new");
  });
  it("returns 'muted' for system events", () => {
    expect(eventoDotTone("fluig_enviado")).toBe("muted");
    expect(eventoDotTone("fluig_erro")).toBe("muted");
    expect(eventoDotTone("email_enviado")).toBe("muted");
  });
});
```

- [ ] **Step 1.6: Run test to verify it fails**

Run: `npx vitest run tests/unit/eventos-format.test.ts`
Expected: FAIL with module-resolution error.

- [ ] **Step 1.7: Implement `lib/eventos-format.ts`**

```ts
import type { EventoType } from "@/lib/eventos";

export type TipoEntidade = "afastamento" | "ocorrencia" | "investigacao";

export type EventoTone = "new" | "approved" | "rejected" | "muted";

export function formatEventoVerb(evento: EventoType): string {
  switch (evento) {
    case "criado":         return "criou";
    case "aprovado":       return "aprovou";
    case "rejeitado":      return "rejeitou";
    case "resubmetido":    return "resubmeteu";
    case "cancelado":      return "cancelou";
    case "fluig_enviado":  return "enviou ao Fluig";
    case "fluig_erro":     return "falhou no Fluig";
    case "email_enviado":  return "enviou email";
  }
}

export function formatEntidadeNoun(tipo: TipoEntidade): string {
  switch (tipo) {
    case "afastamento":   return "afastamento";
    case "ocorrencia":    return "ocorrência";
    case "investigacao":  return "investigação";
  }
}

export function eventoDotTone(evento: EventoType): EventoTone {
  switch (evento) {
    case "aprovado":                              return "approved";
    case "rejeitado":
    case "cancelado":                             return "rejected";
    case "criado":
    case "resubmetido":                           return "new";
    case "fluig_enviado":
    case "fluig_erro":
    case "email_enviado":                         return "muted";
  }
}
```

- [ ] **Step 1.8: Run test to verify it passes**

Run: `npx vitest run tests/unit/eventos-format.test.ts`
Expected: PASS — all describe blocks green.

- [ ] **Step 1.9: Run the full unit suite to confirm no regressions**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 1.10: Commit**

```bash
git add lib/greeting.ts lib/eventos-format.ts tests/unit/greeting.test.ts tests/unit/eventos-format.test.ts
git commit -m "feat(app): greeting + eventos-format helpers for painel"
```

---

## Task 2: `<AppNavMenu>` — client dropdown for nav groups

**Files:**
- Create: `components/layout/app-nav-menu.tsx`

This is the dropdown affordance for `Afastamentos`, `Ocorrências`, `Admin`. The `Painel` tab is a plain link (no dropdown) and is rendered directly by `<AppTopNav>` in Task 5.

- [ ] **Step 2.1: Create `components/layout/app-nav-menu.tsx`**

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { AppNavGroup } from "@/lib/nav";

interface AppNavMenuProps {
  group: AppNavGroup;
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
        {group.items.map((item) => (
          <DropdownMenuItem key={item.href} render={<Link href={item.href} />}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2.2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2.3: Commit**

```bash
git add components/layout/app-nav-menu.tsx
git commit -m "feat(app): AppNavMenu client dropdown for top-nav groups"
```

---

## Task 3: `<AppUserPill>` — client avatar + name + sign-out dropdown

**Files:**
- Create: `components/layout/app-user-pill.tsx`

The user pill has an avatar (initials), the user's first name, and a chevron — clicking opens a small dropdown with two items: `Perfil` (link to `/painel` for now — a real profile page is out of scope), and `Sair` (sign-out). Sign-out runs the supabase browser client and pushes `/login`.

- [ ] **Step 3.1: Create `components/layout/app-user-pill.tsx`**

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, LogOutIcon, UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSupabaseBrowser } from "@/lib/supabase/client";

interface AppUserPillProps {
  firstName: string;
  initials: string;
}

export function AppUserPill({ firstName, initials }: AppUserPillProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleSignOut() {
    setPending(true);
    await getSupabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-2 rounded-full bg-muted px-2 py-1 text-sm hover:bg-muted/80 data-[popup-open]:bg-muted/80"
        aria-label={`Menu de ${firstName}`}
      >
        <Avatar size="sm">
          <AvatarFallback className="bg-[var(--brand-primary-600)] text-[10px] text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium text-foreground">{firstName}</span>
        <ChevronDownIcon className="size-4 opacity-60" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-[180px]">
        <DropdownMenuItem render={<Link href="/painel" />}>
          <UserIcon className="size-4" aria-hidden="true" />
          Perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onClick={handleSignOut}
        >
          <LogOutIcon className="size-4" aria-hidden="true" />
          {pending ? "Saindo…" : "Sair"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3.2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3.3: Commit**

```bash
git add components/layout/app-user-pill.tsx
git commit -m "feat(app): AppUserPill with sign-out dropdown"
```

---

## Task 4: `<AppNotificationBell>` — client UI stub

**Files:**
- Create: `components/layout/app-notification-bell.tsx`

Backend deferred (Section 13 out-of-scope). Ships as a static button with an optional unread-dot prop — wired with `unread={false}` initially. Reserves the slot in the top-nav so when the backend lands it's a one-line swap.

- [ ] **Step 4.1: Create `components/layout/app-notification-bell.tsx`**

```tsx
"use client";

import { BellIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppNotificationBellProps {
  unread?: boolean;
}

export function AppNotificationBell({ unread = false }: AppNotificationBellProps) {
  return (
    <button
      type="button"
      aria-label="Notificações"
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-md text-[var(--color-fg-muted)]",
        "hover:bg-muted hover:text-foreground",
      )}
    >
      <BellIcon className="size-5" aria-hidden="true" />
      {unread && (
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 size-2 rounded-full bg-[var(--brand-accent-500)] ring-2 ring-background"
        />
      )}
    </button>
  );
}
```

- [ ] **Step 4.2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4.3: Commit**

```bash
git add components/layout/app-notification-bell.tsx
git commit -m "feat(app): AppNotificationBell UI stub (backend deferred)"
```

---

## Task 5: `<AppTopNav>` — server component orchestrator

**Files:**
- Create: `components/layout/app-top-nav.tsx`

Reads `supabase.auth.getUser()`, then `usuarios.nome` + `usuarios.administrador`. Renders: brand (linked to `/`) + tabs (Painel link + AppNavMenu dropdowns, filtering out admin for non-admins) + bell + user pill. Sticky `top-0` with a 2px accent-orange underline anchored to the left edge under the brand.

Active-tab detection is best-effort here: we use the **pathname header** that Next.js exposes to the layout indirectly. Since this is a server component without `usePathname`, active state is computed inside `<AppNavMenu>` via the `active` prop we pass down — but we'd have to know the path. **Trade-off:** Active state on the tab labels is a small detail; for v1 we ship with `active={false}` and let the dropdown items themselves visually communicate context. The painel tab is always visible and always rendered as a link; if visual active-state on the tab label becomes important, a thin client wrapper can be added later.

- [ ] **Step 5.1: Create `components/layout/app-top-nav.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { AppNavMenu } from "@/components/layout/app-nav-menu";
import { AppUserPill } from "@/components/layout/app-user-pill";
import { AppNotificationBell } from "@/components/layout/app-notification-bell";
import { appNav } from "@/lib/nav";
import { getSupabaseServer } from "@/lib/supabase/server";

function deriveInitials(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0]!.slice(0, 2).toUpperCase();
  return (tokens[0]![0]! + tokens[tokens.length - 1]![0]!).toUpperCase();
}

export async function AppTopNav() {
  const supabase = await getSupabaseServer();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: row } = await supabase
    .from("usuarios")
    .select("nome, administrador")
    .eq("id", authUser.id)
    .single();

  const nome = row?.nome?.trim() ?? "";
  const firstName = nome ? nome.split(/\s+/)[0]! : "Usuário";
  const initials = deriveInitials(nome || firstName);
  const isAdmin = row?.administrador === true;

  const groups = appNav.filter((g) => !g.adminOnly || isAdmin);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="relative mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" aria-label="Início" className="shrink-0">
          <Logo size="md" />
        </Link>

        <nav aria-label="Navegação principal" className="hidden items-center gap-1 md:flex">
          {groups.map((group) =>
            group.items.length === 0 ? (
              <Link
                key={group.id}
                href={group.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:bg-muted hover:text-foreground"
              >
                {group.label}
              </Link>
            ) : (
              <AppNavMenu key={group.id} group={group} active={false} />
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <AppNotificationBell />
          <AppUserPill firstName={firstName} initials={initials} />
        </div>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[-1px] left-4 h-[2px] w-10 bg-[var(--brand-accent-500)]"
        />
      </div>
    </header>
  );
}
```

- [ ] **Step 5.2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5.3: Commit**

```bash
git add components/layout/app-top-nav.tsx
git commit -m "feat(app): AppTopNav server component composing brand + tabs + pill"
```

---

## Task 6: rewrite `(app)/layout.tsx` + `(admin)/layout.tsx` + delete old `TopNav`

**Files:**
- Modify: `app/(app)/layout.tsx`
- Modify: `app/(admin)/layout.tsx`
- Delete: `components/nav/top-nav.tsx`

The new layouts retain the auth-gate (and admin-gate) but render `<AppTopNav>` instead. Both wrap children in a centered max-width container with vertical padding so list/detail pages don't have to re-establish that.

- [ ] **Step 6.1: Rewrite `app/(app)/layout.tsx`**

Replace entire file:

```tsx
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { AppTopNav } from "@/components/layout/app-top-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-[var(--color-bg-subtle)]">
      <AppTopNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 6.2: Rewrite `app/(admin)/layout.tsx`**

Replace entire file:

```tsx
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { AppTopNav } from "@/components/layout/app-top-nav";

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
    <div className="min-h-screen bg-[var(--color-bg-subtle)]">
      <AppTopNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 6.3: Delete the old TopNav**

Run: `git rm components/nav/top-nav.tsx`
Then check the `components/nav/` directory:

Run: `ls components/nav/ 2>/dev/null || echo "empty"`
If empty, also remove the directory: `rmdir components/nav/ 2>/dev/null || true`

- [ ] **Step 6.4: Confirm nothing else imports the old TopNav**

Run: `grep -rn "components/nav/top-nav\|@/components/nav" app components lib tests 2>/dev/null || echo "no references"`
Expected: "no references".

- [ ] **Step 6.5: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean build.

- [ ] **Step 6.6: Commit**

```bash
git add app/'(app)'/layout.tsx app/'(admin)'/layout.tsx components/nav/top-nav.tsx
git commit -m "feat(app): wire AppTopNav into (app) and (admin) layouts; remove old TopNav"
```

---

## Task 7: `<QuickAction>` + `<KpiCard>` — painel UI primitives

**Files:**
- Create: `components/painel/quick-action.tsx`
- Create: `components/painel/kpi-card.tsx`

`<QuickAction>` is a clickable card with an icon chip on the left, a title + sub on the right, optional count pill in the top-right corner, and a colored bottom edge strip. `<KpiCard>` is a static stat card: label + large value + optional delta line + colored bottom edge strip.

Both accept a `tone` prop: `"primary"` (blue) or `"accent"` (orange). The bottom edge strip is a `2px` div with `bg-[var(--brand-primary-600)]` or `bg-[var(--brand-accent-500)]`. No `rounded-full` on these strips (they're rectangular accents).

- [ ] **Step 7.1: Create `components/painel/quick-action.tsx`**

```tsx
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuickActionTone = "primary" | "accent";

interface QuickActionProps {
  href: string;
  icon: LucideIcon;
  title: string;
  sub: string;
  tone?: QuickActionTone;
  /** Optional count pill in the top-right (e.g., pending count). */
  count?: number;
}

const toneMap: Record<QuickActionTone, { chip: string; strip: string }> = {
  primary: {
    chip: "bg-[var(--brand-primary-50)] text-[var(--brand-primary-600)]",
    strip: "bg-[var(--brand-primary-600)]",
  },
  accent: {
    chip: "bg-[var(--brand-accent-50)] text-[var(--brand-accent-500)]",
    strip: "bg-[var(--brand-accent-500)]",
  },
};

export function QuickAction({
  href, icon: Icon, title, sub, tone = "accent", count,
}: QuickActionProps) {
  const t = toneMap[tone];
  return (
    <Link
      href={href}
      className="group relative flex items-start gap-3 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-xs)] transition hover:shadow-[var(--shadow-md)]"
    >
      <span
        aria-hidden="true"
        className={cn("grid size-10 place-items-center rounded-[var(--radius-lg)]", t.chip)}
      >
        <Icon className="size-5" />
      </span>
      <span className="flex flex-1 flex-col">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-xs text-[var(--color-fg-muted)]">{sub}</span>
      </span>
      {typeof count === "number" && count > 0 && (
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--brand-accent-500)] px-1.5 text-xs font-semibold text-white">
          {count}
        </span>
      )}
      <span aria-hidden="true" className={cn("absolute inset-x-0 bottom-0 h-[2px]", t.strip)} />
    </Link>
  );
}
```

- [ ] **Step 7.2: Create `components/painel/kpi-card.tsx`**

```tsx
import { cn } from "@/lib/utils";
import type { QuickActionTone } from "@/components/painel/quick-action";

interface KpiCardProps {
  label: string;
  value: number | string;
  /** Optional second-line context, e.g. "+2 esta semana". */
  delta?: string;
  tone?: QuickActionTone;
}

const toneStrip: Record<QuickActionTone, string> = {
  primary: "bg-[var(--brand-primary-600)]",
  accent:  "bg-[var(--brand-accent-500)]",
};

export function KpiCard({ label, value, delta, tone = "primary" }: KpiCardProps) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-xs)]">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      {delta && (
        <p className="mt-1 text-xs text-[var(--color-fg-muted)]">{delta}</p>
      )}
      <span aria-hidden="true" className={cn("absolute inset-x-0 bottom-0 h-[2px]", toneStrip[tone])} />
    </div>
  );
}
```

- [ ] **Step 7.3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7.4: Commit**

```bash
git add components/painel/quick-action.tsx components/painel/kpi-card.tsx
git commit -m "feat(app): QuickAction + KpiCard painel primitives"
```

---

## Task 8: `<PainelHero>` — gradient hero banner

**Files:**
- Create: `components/painel/painel-hero.tsx`

The hero surfaces the single most urgent metric. It's a gradient banner (blue + orange radial glow) with the headline metric, a sub-line, an optional CTA link, and a 3px accent-orange bottom edge strip. Re-uses the radial-glow pattern from `<AuthCard>` brand-panel for visual consistency. The greeting + date live in a separate page-head rendered by the painel page (Task 10), per parent spec §7.

- [ ] **Step 8.1: Create `components/painel/painel-hero.tsx`**

```tsx
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

interface PainelHeroProps {
  /** Headline metric, e.g. "3 aprovações aguardando sua revisão." */
  headline: string;
  /** Sub-copy explaining context. */
  sub: string;
  /** Optional CTA. */
  cta?: { href: string; label: string };
}

export function PainelHero({ headline, sub, cta }: PainelHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-xl)] bg-gradient-to-br from-[var(--brand-primary-600)] to-[var(--brand-primary-900)] p-6 text-white sm:p-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at top right, color-mix(in oklab, var(--brand-accent-500) 30%, transparent), transparent 60%)",
        }}
      />
      <div className="relative">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{headline}</h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">{sub}</p>
        {cta && (
          <Link
            href={cta.href}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-accent-500)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand-accent-600)]"
          >
            {cta.label}
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--brand-accent-500)]"
      />
    </section>
  );
}
```

- [ ] **Step 8.2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8.3: Commit**

```bash
git add components/painel/painel-hero.tsx
git commit -m "feat(app): PainelHero gradient banner with accent edge strip"
```

---

## Task 9: `<ActivityFeed>` — recent eventos list

**Files:**
- Create: `components/painel/activity-feed.tsx`

Reads the `eventos` table (top 5 by `ocorrido_em` desc) with a join to `usuarios.nome` via `autor_id`. Renders rows with: a colored status dot, "{autor} — {verbo} {entidade}", and a relative-time suffix. Empty state shows a muted placeholder.

`<ActivityFeed>` accepts the data via prop so the painel page owns the supabase call. This keeps the component pure-render and testable.

- [ ] **Step 9.1: Create `components/painel/activity-feed.tsx`**

```tsx
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  eventoDotTone,
  formatEntidadeNoun,
  formatEventoVerb,
  type TipoEntidade,
} from "@/lib/eventos-format";
import type { EventoType } from "@/lib/eventos";

export interface ActivityFeedRow {
  id: string;
  tipo_entidade: TipoEntidade;
  entidade_id: string;
  evento: EventoType;
  ocorrido_em: string;
  autor_nome: string | null;
}

const dotColor: Record<ReturnType<typeof eventoDotTone>, string> = {
  new:       "bg-[var(--color-info)]",
  approved:  "bg-[var(--color-success)]",
  rejected:  "bg-[var(--color-danger)]",
  muted:     "bg-[var(--color-fg-subtle)]",
};

function detailHref(row: ActivityFeedRow): string {
  if (row.tipo_entidade === "afastamento") return `/afastamentos/${row.entidade_id}`;
  if (row.tipo_entidade === "ocorrencia") return `/ocorrencias/${row.entidade_id}`;
  return `/ocorrencias/${row.entidade_id}/investigacao`;
}

interface ActivityFeedProps {
  rows: ActivityFeedRow[];
  seeAllHref?: string;
}

export function ActivityFeed({ rows, seeAllHref }: ActivityFeedProps) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-xs)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="text-sm font-semibold">Atividade recente</h2>
        {seeAllHref && (
          <Link href={seeAllHref} className="text-xs text-[var(--color-fg-muted)] hover:text-foreground">
            Ver tudo →
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[var(--color-fg-muted)]">Sem atividade recente.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {rows.map((row) => {
            const tone = eventoDotTone(row.evento);
            const autor = row.autor_nome?.trim() || "Sistema";
            const verbo = formatEventoVerb(row.evento);
            const noun = formatEntidadeNoun(row.tipo_entidade);
            const when = formatDistanceToNow(new Date(row.ocorrido_em), {
              addSuffix: true,
              locale: ptBR,
            });
            return (
              <li key={row.id}>
                <Link
                  href={detailHref(row)}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50"
                >
                  <span
                    aria-hidden="true"
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", dotColor[tone])}
                  />
                  <span className="flex-1 text-sm">
                    <span className="font-medium text-foreground">{autor}</span>{" "}
                    <span className="text-[var(--color-fg-muted)]">{verbo} {noun}</span>
                  </span>
                  <span className="font-mono text-xs text-[var(--color-fg-subtle)]">{when}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 9.2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9.3: Commit**

```bash
git add components/painel/activity-feed.tsx
git commit -m "feat(app): ActivityFeed component reading eventos with PT relative time"
```

---

## Task 10: rewrite `/painel` — parallel queries + composition

**Files:**
- Modify: `app/(app)/painel/page.tsx`

The painel is a server component. Per parent spec §7 the body is `page-head + hero banner + 2-column grid`:

- **Page-head**: "Painel" label on the left, greeting ("Bom dia, Maria") immediately under it, current date right-aligned (PT-BR weekday + day + month).
- **Hero banner**: gradient banner with the urgent headline.
- **Two-column grid** (`md:grid-cols-2`):
  - **Left**: 2×2 quick-action grid.
  - **Right**: two KPI cards in a row + activity feed below.

Four supabase queries run in parallel (two KPI counts, one pendentes count for the hero, one feed query).

- [ ] **Step 10.1: Rewrite `app/(app)/painel/page.tsx`**

Replace entire file:

```tsx
import {
  CheckCircle2Icon,
  FileEditIcon,
  ListChecksIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { greetingFor } from "@/lib/greeting";
import { PainelHero } from "@/components/painel/painel-hero";
import { QuickAction } from "@/components/painel/quick-action";
import { KpiCard } from "@/components/painel/kpi-card";
import {
  ActivityFeed,
  type ActivityFeedRow,
} from "@/components/painel/activity-feed";

interface EventoRow {
  id: string;
  tipo_entidade: ActivityFeedRow["tipo_entidade"];
  entidade_id: string;
  evento: ActivityFeedRow["evento"];
  ocorrido_em: string;
  usuarios: { nome: string | null } | null;
}

export default async function PainelPage() {
  const supabase = await getSupabaseServer();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nome")
    .eq("id", authUser!.id)
    .single();
  const firstName = (usuario?.nome?.trim() || "").split(/\s+/)[0] || "Usuário";

  const [pendentesRes, ativosRes, ocorrenciasAbertasRes, recentesRes] =
    await Promise.all([
      supabase
        .from("afastamentos").select("id", { count: "exact", head: true })
        .eq("situacao", "pendente"),
      supabase
        .from("afastamentos").select("id", { count: "exact", head: true })
        .in("situacao", ["aprovado", "em_andamento"]),
      supabase
        .from("ocorrencias").select("id", { count: "exact", head: true })
        .eq("situacao", "aberta"),
      supabase
        .from("eventos")
        .select("id, tipo_entidade, entidade_id, evento, ocorrido_em, usuarios:autor_id(nome)")
        .order("ocorrido_em", { ascending: false })
        .limit(5)
        .returns<EventoRow[]>(),
    ]);

  const pendentes = pendentesRes.count ?? 0;
  const ativos = ativosRes.count ?? 0;
  const ocorrenciasAbertas = ocorrenciasAbertasRes.count ?? 0;

  const recentes: ActivityFeedRow[] = (recentesRes.data ?? []).map((row) => ({
    id: row.id,
    tipo_entidade: row.tipo_entidade,
    entidade_id: row.entidade_id,
    evento: row.evento,
    ocorrido_em: row.ocorrido_em,
    autor_nome: row.usuarios?.nome ?? null,
  }));

  const now = new Date();
  const greeting = greetingFor(now.getHours());
  const formattedDate = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const heroHeadline =
    pendentes === 0
      ? "Nada pendente — tudo em dia."
      : `${pendentes} ${pendentes === 1 ? "aprovação aguardando" : "aprovações aguardando"} sua revisão.`;
  const heroSub =
    pendentes === 0
      ? "Acompanhe os afastamentos ativos e as ocorrências abertas pelos cartões abaixo."
      : "Revise as solicitações pendentes antes do fim do dia para manter o fluxo.";

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
            Painel
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {greeting}, {firstName}.
          </p>
        </div>
        <p className="font-mono text-xs text-[var(--color-fg-subtle)] first-letter:uppercase">
          {formattedDate}
        </p>
      </header>

      <PainelHero
        headline={heroHeadline}
        sub={heroSub}
        cta={pendentes > 0 ? { href: "/afastamentos/aprovacoes", label: "Ver aprovações" } : undefined}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <QuickAction
            href="/afastamentos/aprovacoes"
            icon={CheckCircle2Icon}
            title="Aprovações"
            sub="Revisar afastamentos pendentes"
            tone="primary"
            count={pendentes}
          />
          <QuickAction
            href="/afastamentos"
            icon={ListChecksIcon}
            title="Afastamentos"
            sub="Lista completa"
            tone="accent"
          />
          <QuickAction
            href="/ocorrencias"
            icon={AlertTriangleIcon}
            title="Ocorrências"
            sub="Aberturas e investigações"
            tone="accent"
          />
          <QuickAction
            href="/forms/afastamentos"
            icon={FileEditIcon}
            title="Novo afastamento"
            sub="Formulário público"
            tone="accent"
          />
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              label="Afastamentos ativos"
              value={ativos}
              delta={ativos === 0 ? "—" : `${ativos} em curso`}
              tone="primary"
            />
            <KpiCard
              label="Ocorrências abertas"
              value={ocorrenciasAbertas}
              delta={ocorrenciasAbertas === 0 ? "—" : `${ocorrenciasAbertas} aguardando investigação`}
              tone="accent"
            />
          </div>
          <ActivityFeed rows={recentes} seeAllHref="/afastamentos" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 10.2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10.3: Build**

Run: `npm run build`
Expected: clean build, all routes pre-compile.

- [ ] **Step 10.4: Commit**

```bash
git add app/'(app)'/painel/page.tsx
git commit -m "feat(app): rewrite /painel as operational hub with parallel queries"
```

---

## Task 11: E2E — logged-in painel render-smoke

**Files:**
- Create: `tests/e2e/painel.spec.ts`

A single test that logs in (using the same `E2E_OH_EMAIL` / `E2E_OH_PASSWORD` env vars as `happy-path.spec.ts`) and asserts the painel surfaces are visible: hero h1 + at least one quick action + the activity-feed section title + a KPI label. Also asserts the top-nav brand link and the user pill render.

- [ ] **Step 11.1: Create `tests/e2e/painel.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

const OH_EMAIL = process.env.E2E_OH_EMAIL!;
const OH_PASSWORD = process.env.E2E_OH_PASSWORD!;

test("private shell + /painel render after login", async ({ page }) => {
  await page.goto("/login");
  await page.locator("input[type=email]").fill(OH_EMAIL);
  await page.locator("input[type=password]").fill(OH_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/painel/);

  // Top-nav: brand link + at least the Painel tab + user pill present
  await expect(page.getByRole("link", { name: "Início" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Painel", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Menu de / })).toBeVisible();

  // Hero h1 (either "Nada pendente..." or "N aprovações aguardando...")
  const hero = page.getByRole("heading", { level: 1 });
  await expect(hero).toBeVisible();
  await expect(hero).toContainText(/(Nada pendente|aprovaç)/);

  // Quick-action grid: at least the Aprovações card
  await expect(page.getByRole("link", { name: /Aprovações.*Revisar/s })).toBeVisible();

  // Activity feed section heading
  await expect(page.getByRole("heading", { name: "Atividade recente" })).toBeVisible();

  // KPI card label
  await expect(page.getByText("Afastamentos ativos")).toBeVisible();
});
```

- [ ] **Step 11.2: Run the E2E suite**

Run: `npx playwright test tests/e2e/painel.spec.ts`
Expected: 1 passed. (Other E2E specs may pass too if run together; this task only requires the new one to be green.)

- [ ] **Step 11.3: Run the full test matrix to confirm no regressions**

Run: `npx vitest run && npx playwright test`
Expected: all tests pass.

- [ ] **Step 11.4: Commit**

```bash
git add tests/e2e/painel.spec.ts
git commit -m "test(app): e2e smoke for private shell + /painel"
```

---

## Task 12: mark Phase 4 complete in parent spec

**Files:**
- Modify: `docs/superpowers/specs/2026-05-14-frontend-redesign-design.md`

- [ ] **Step 12.1: Add the status line under the Phase 4 heading**

Find the section that currently reads:

```markdown
### Phase 4 — Private app shell + `/painel`

The operational landing.
```

Replace with:

```markdown
### Phase 4 — Private app shell + `/painel`
**Status:** ✅ Complete (commit range: <FIRST_SHA>..<LAST_SHA>)

The operational landing.
```

Replace `<FIRST_SHA>` and `<LAST_SHA>` with the actual first and last commit SHAs of this phase (Task 1's commit through Task 11's commit). Use `git log --oneline -n 20` to read them.

- [ ] **Step 12.2: Commit**

```bash
git add docs/superpowers/specs/2026-05-14-frontend-redesign-design.md
git commit -m "docs: mark Phase 4 complete in parent design spec"
```

---

## Verification at end of phase

After the final commit, run:

```bash
npx vitest run
npx playwright test
npm run build
```

All three must be green. Visit `/painel` in the dev server (`npm run dev`) and confirm:

1. The sticky top-nav shows the gradient logo + `Painel` tab + dropdowns for `Afastamentos` / `Ocorrências` (and `Admin` if the test user is an admin).
2. The bell icon renders and is hoverable; the user pill shows initials + first name; clicking it opens a dropdown with `Perfil` and `Sair`.
3. Clicking `Sair` signs out and redirects to `/login`.
4. The painel shows: gradient hero with greeting + headline metric, 2×2 quick-action grid, two KPI cards, recent activity feed (or "Sem atividade recente." if empty).
5. The activity feed rows display PT verbs ("criou afastamento", "aprovou ocorrência") with a relative-time suffix ("há 2 horas", etc.).
6. Form controls inside the shell stay at the established ≤4px radius; no `rounded-full` on rectangular accent strips (only on avatar circles, status dots, and the count pill).
