# Frontend Redesign — Phase 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the design-token layer, install all shadcn primitives, type the navigation/link configs, and ship the brand mark + wordmark components — so every subsequent phase can compose from a stable foundation. No user-visible UI changes yet; existing pages keep their current bare look until Phase 2+.

**Architecture:** Pure additive foundation work. `app/tokens.css` is rewritten in place (replacement, not append). `lib/public-links.ts` and `lib/nav.ts` are new typed config modules with seed data. The two brand components live in `components/brand/` with no external dependencies beyond `lucide-react` and `cn` from `lib/utils.ts`. shadcn primitives are added via the CLI which respects the existing `components.json` style `base-nova`.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, shadcn (style `base-nova`, registry uses `@base-ui/react`), lucide-react, TypeScript, Vitest.

**Spec reference:** `docs/superpowers/specs/2026-05-14-frontend-redesign-design.md` (Section 2 constraints, Section 4 tokens, Section 11 component inventory, Section 12 phase 1).

---

## File Structure (this phase)

**Created:**
- `lib/public-links.ts` — typed config + seed data for the public linktree landing
- `lib/nav.ts` — typed config for the private top-nav menus
- `components/brand/logo-mark.tsx` — square mark with gradient (orange→blue), three sizes
- `components/brand/logo.tsx` — mark + "MAIA · ENGEKO" wordmark, three sizes, optional muted variant
- `tests/unit/public-links.test.ts` — shape + non-emptiness checks for the typed config
- `tests/unit/nav.test.ts` — shape + non-emptiness checks for the typed config

**Modified:**
- `app/tokens.css` — full rewrite to the new token surface (brand + surface + status + spacing + radii + shadow + type)
- `components/ui/*` — many new files added by `npx shadcn add` (managed by shadcn CLI, not hand-edited)

**Deleted:** none in this phase.

**No-op for this phase:** `app/page.tsx`, `app/(app)/*`, `app/(admin)/*`, `app/(auth)/*`, `app/(public)/*`, `app/api/*`, `middleware.ts`, `lib/supabase/*`, `lib/eventos.ts`, `emails/*`. All of these continue to render with their current code; only their *color* shifts slightly once `tokens.css` is replaced (no structural changes).

---

## Task 1: Replace `app/tokens.css` with the new token surface

Pure config swap. No tests — the canonical check is `npm run build` passing and no visual regressions on existing pages beyond color drift.

**Files:**
- Modify: `app/tokens.css` (full file replacement)

- [ ] **Step 1: Read the current file to confirm scope**

Run: open `app/tokens.css` and confirm it's the 32-line file from the current main branch. If it has unexpected content, stop and ask before proceeding.

- [ ] **Step 2: Replace the file contents**

Replace the entire file with:

```css
:root {
  /* === Brand — single source of truth (swap these hex when real ENGEKO palette arrives) === */
  --brand-primary-50:  #eef3fb;
  --brand-primary-100: #d6e1f3;
  --brand-primary-500: #1e3a8a;
  --brand-primary-600: #0b3a82;
  --brand-primary-700: #082b62;
  --brand-primary-900: #04183a;

  --brand-accent-50:   #fff3e8;
  --brand-accent-500:  #ea580c;
  --brand-accent-600:  #c2410c;

  /* === Surface === */
  --color-bg:            #ffffff;
  --color-bg-subtle:     #f8fafc;
  --color-bg-muted:      #f1f5f9;
  --color-fg:            #0f172a;
  --color-fg-muted:      #475569;
  --color-fg-subtle:     #94a3b8;
  --color-border:        #e2e8f0;
  --color-border-strong: #cbd5e1;

  --color-primary:       var(--brand-primary-600);
  --color-primary-fg:    #ffffff;
  --color-primary-hover: var(--brand-primary-700);
  --color-primary-soft:  var(--brand-primary-50);

  --color-accent:        var(--brand-accent-500);
  --color-accent-fg:     #ffffff;
  --color-accent-soft:   var(--brand-accent-50);

  --color-success: #16a34a;  --color-success-soft: #dcfce7;
  --color-warning: #d97706;  --color-warning-soft: #fef3c7;
  --color-danger:  #dc2626;  --color-danger-soft:  #fee2e2;
  --color-info:    #2563eb;  --color-info-soft:    #dbeafe;

  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
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
  --leading-tight: 1.2;
  --leading-normal: 1.5;
  --tracking-tight: -0.015em;
}
```

- [ ] **Step 3: Update `app/globals.css` to expose the new accent + soft-color mappings**

The existing file already imports `tokens.css` and maps a subset of vars to Tailwind. Extend the `@theme inline` block so `bg-accent`, `bg-accent-foreground`, and the `*-soft` variants resolve.

Replace the entire `@theme inline { … }` block in `app/globals.css` with:

```css
@theme inline {
  --color-background: var(--color-bg);
  --color-foreground: var(--color-fg);
  --color-primary:    var(--color-primary);
  --color-primary-foreground: var(--color-primary-fg);
  --color-accent:     var(--color-accent);
  --color-accent-foreground: var(--color-accent-fg);
  --color-border:     var(--color-border);
  --color-muted:      var(--color-bg-muted);
  --color-muted-foreground: var(--color-fg-muted);
  --color-destructive: var(--color-danger);
  --font-sans: var(--font-sans);
  --radius:    var(--radius-md);
  --color-ring:       var(--color-primary);
  --color-input:      var(--color-border);
}
```

(The change vs. the current block: added `--color-accent` + `--color-accent-foreground`; switched `--color-muted` to map to `--color-bg-muted` instead of `--color-bg-subtle` so muted backgrounds are visibly distinct from page-bg.)

- [ ] **Step 4: Verify the build passes**

Run: `npm run build`
Expected: build succeeds with no TypeScript or CSS errors. Some lint warnings about unused vars are fine; no errors.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev` in a second terminal. Open `http://localhost:3000/login` in a browser. The bare login page should still render (it queries no DB and uses raw `<input>`), but the `bg-primary` button should now be `#0b3a82` blue (previously `#1e40af`).

Stop the dev server (`Ctrl+C`) when confirmed.

- [ ] **Step 6: Commit**

```bash
git add app/tokens.css app/globals.css
git commit -m "$(cat <<'EOF'
feat(tokens): redesigned token surface with ENGEKO brand layer

Adds a brand-variable layer (primary/accent in 50–900 scale) separate
from semantic surface tokens, so real ENGEKO hex values swap in one
place. Accent (safety orange) is now a first-class role. Status soft
backgrounds, richer shadow/radius scales, denser type scale (base 15px).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Install shadcn primitives

Batch-install all primitives from spec Section 11 in one task. The shadcn CLI respects the existing `components.json` (style `base-nova`, registry `@base-ui/react`).

**Files:**
- Create: 17 new files under `components/ui/` (managed by shadcn CLI)

- [ ] **Step 1: Run the shadcn install command**

Run the install commands one-by-one (shadcn CLI takes one name per invocation in some versions; chain with `&&` and capture output):

```bash
npx shadcn@latest add card input field dropdown-menu avatar badge breadcrumb sheet table form dialog select checkbox radio-group tabs tooltip skeleton
```

Expected: the CLI prompts to overwrite any existing primitive (none should already exist in this list — confirm by reading `components/ui/` before running). For each component, it writes a file under `components/ui/<name>.tsx`. Some components may pull in helpers (e.g. `dialog` may add `components/ui/dialog.tsx` plus a portal wrapper).

If the CLI errors on a specific component (e.g. "no base-nova variant for X"), fall back to:
```bash
npx shadcn@latest add <name> --style=new-york
```
and note the divergence in the commit message.

- [ ] **Step 2: Inspect the new files**

Run: `ls components/ui/`

Expected: at minimum the 17 new files listed in the install command (some may include additional sub-files like `form.tsx` adding internal helpers). Verify there are no `*.bak` or `*.orig` files left behind.

- [ ] **Step 3: Verify the build still passes**

Run: `npm run build`
Expected: build succeeds. If any newly installed primitive has a TS error (most common: stale React types, Tailwind v4 class names), fix the specific error rather than reverting. shadcn primitives are intended to be edited.

- [ ] **Step 4: Run the existing unit tests**

Run: `npx vitest run`
Expected: all existing tests pass (5 test files: afastamento-state, edit-token, eventos, permissions, validation). No regressions — shadcn additions don't touch logic modules.

- [ ] **Step 5: Commit**

```bash
git add components/ui/ package.json package-lock.json
git commit -m "$(cat <<'EOF'
feat(ui): install shadcn primitives for redesign foundation

Adds card, input, field, dropdown-menu, avatar, badge, breadcrumb,
sheet, table, form, dialog, select, checkbox, radio-group, tabs,
tooltip, skeleton via shadcn CLI (style base-nova, base-ui/react).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add `lib/public-links.ts` (typed + seeded)

TDD: write a logic test first that asserts the shape and non-emptiness of the exported config, then create the module so the test passes.

**Files:**
- Create: `lib/public-links.ts`
- Test: `tests/unit/public-links.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/public-links.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { publicLinks, type PublicLinkGroup, type PublicLinkItem } from "@/lib/public-links";

describe("publicLinks config", () => {
  it("exports at least one group", () => {
    expect(publicLinks.length).toBeGreaterThan(0);
  });

  it("every group has a non-empty title and at least one item", () => {
    for (const group of publicLinks as PublicLinkGroup[]) {
      expect(group.title.trim().length).toBeGreaterThan(0);
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it("every item has the required fields with valid types", () => {
    const validTypes: PublicLinkItem["type"][] = ["internal", "external"];
    for (const group of publicLinks) {
      for (const item of group.items) {
        expect(item.title.trim().length).toBeGreaterThan(0);
        expect(item.description.trim().length).toBeGreaterThan(0);
        expect(item.url.trim().length).toBeGreaterThan(0);
        expect(item.icon.trim().length).toBeGreaterThan(0);
        expect(validTypes).toContain(item.type);
      }
    }
  });

  it("internal items use relative URLs and external items use absolute URLs", () => {
    for (const group of publicLinks) {
      for (const item of group.items) {
        if (item.type === "internal") {
          expect(item.url.startsWith("/"), `internal "${item.title}" must start with /`).toBe(true);
        } else {
          expect(/^https?:\/\//.test(item.url), `external "${item.title}" must be http(s)://`).toBe(true);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run tests/unit/public-links.test.ts`
Expected: FAIL with `Cannot find module '@/lib/public-links'`.

- [ ] **Step 3: Create the module**

Create `lib/public-links.ts`:

```ts
/**
 * Public linktree config for the landing page at `/`.
 *
 * Internal items are routes inside maia-app (must start with `/`).
 * External items open in a new tab (must be absolute http(s) URLs).
 */

export type PublicLinkType = "internal" | "external";

export interface PublicLinkItem {
  title: string;
  description: string;
  url: string;
  /** lucide-react icon name, e.g. "file-text", "siren" */
  icon: string;
  type: PublicLinkType;
}

export interface PublicLinkGroup {
  title: string;
  items: PublicLinkItem[];
}

export const publicLinks: PublicLinkGroup[] = [
  {
    title: "Formulários",
    items: [
      {
        title: "Atestados e Declarações",
        description: "Entregar atestado médico, declaração ou comprovante de internação.",
        url: "/forms/afastamentos",
        icon: "file-text",
        type: "internal",
      },
      {
        title: "Comunicação de Ocorrências",
        description: "Registrar uma ocorrência de segurança do trabalho.",
        url: "/forms/ocorrencias",
        icon: "siren",
        type: "internal",
      },
    ],
  },
  {
    title: "Sistemas Externos",
    items: [
      {
        title: "SOC",
        description: "Sistema de saúde ocupacional — sistema.soc.com.br",
        url: "https://sistema.soc.com.br/WebSoc/",
        icon: "external-link",
        type: "external",
      },
      {
        title: "Obrasoft",
        description: "Gestão de obras — obrasoft.com.br",
        url: "https://www.obrasoft.com.br/Acesso/login.aspx",
        icon: "external-link",
        type: "external",
      },
      {
        title: "GreenLegis",
        description: "Compliance regulatório — greenlegis.com.br",
        url: "https://sistema.greenlegis.com.br/login",
        icon: "external-link",
        type: "external",
      },
    ],
  },
];
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run tests/unit/public-links.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/public-links.ts tests/unit/public-links.test.ts
git commit -m "$(cat <<'EOF'
feat(lib): typed public-links config for landing linktree

Seeds Formulários (internal app forms) and Sistemas Externos (SOC,
Obrasoft, GreenLegis) groups. Phase 2 consumes this in the public
landing page component.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add `lib/nav.ts` (typed + seeded)

Same TDD pattern. Provides the typed config for the private top-nav menus (Afastamentos / Ocorrências / Admin submenus).

**Files:**
- Create: `lib/nav.ts`
- Test: `tests/unit/nav.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/nav.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { appNav, type AppNavGroup, type AppNavItem } from "@/lib/nav";

describe("appNav config", () => {
  it("exports the four expected groups in order: painel, afastamentos, ocorrencias, admin", () => {
    expect(appNav.map((g: AppNavGroup) => g.id)).toEqual([
      "painel",
      "afastamentos",
      "ocorrencias",
      "admin",
    ]);
  });

  it("every group has a label and a route", () => {
    for (const group of appNav) {
      expect(group.label.trim().length).toBeGreaterThan(0);
      expect(group.href.startsWith("/")).toBe(true);
    }
  });

  it("groups with submenus have at least one submenu item, others have empty submenu", () => {
    for (const group of appNav) {
      if (group.id === "painel") {
        expect(group.items.length).toBe(0);
      } else {
        expect(group.items.length).toBeGreaterThan(0);
      }
    }
  });

  it("every submenu item has a label and a relative route", () => {
    for (const group of appNav) {
      for (const item of group.items as AppNavItem[]) {
        expect(item.label.trim().length).toBeGreaterThan(0);
        expect(item.href.startsWith("/")).toBe(true);
      }
    }
  });

  it("admin group is flagged adminOnly", () => {
    const admin = appNav.find((g) => g.id === "admin")!;
    expect(admin.adminOnly).toBe(true);
  });

  it("non-admin groups are not adminOnly", () => {
    for (const group of appNav) {
      if (group.id !== "admin") {
        expect(group.adminOnly ?? false).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run tests/unit/nav.test.ts`
Expected: FAIL with `Cannot find module '@/lib/nav'`.

- [ ] **Step 3: Create the module**

Create `lib/nav.ts`:

```ts
/**
 * Private top-nav config. Phase 4 builds the AppTopNav component that
 * consumes this. Admin groups are filtered out for non-admin users.
 */

export interface AppNavItem {
  label: string;
  href: string;
  /** lucide-react icon name (optional — submenu items typically don't show icons) */
  icon?: string;
}

export interface AppNavGroup {
  /** Stable identifier (used for active-tab detection and tests). */
  id: "painel" | "afastamentos" | "ocorrencias" | "admin";
  /** Display label in the top-nav. */
  label: string;
  /** Root route for the group. Painel uses this as the link target directly; others use it for active-state matching. */
  href: string;
  /** Submenu items. Empty array for groups without a dropdown (Painel). */
  items: AppNavItem[];
  /** When true, the group is hidden from non-admin users. */
  adminOnly?: boolean;
}

export const appNav: AppNavGroup[] = [
  {
    id: "painel",
    label: "Painel",
    href: "/painel",
    items: [],
  },
  {
    id: "afastamentos",
    label: "Afastamentos",
    href: "/afastamentos",
    items: [
      { label: "Lista", href: "/afastamentos" },
      { label: "Aprovações", href: "/afastamentos/aprovacoes" },
    ],
  },
  {
    id: "ocorrencias",
    label: "Ocorrências",
    href: "/ocorrencias",
    items: [
      { label: "Lista", href: "/ocorrencias" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    href: "/admin",
    adminOnly: true,
    items: [
      { label: "Empresas", href: "/admin/empresas" },
      { label: "Unidades", href: "/admin/unidades" },
      { label: "Equipes", href: "/admin/equipes" },
      { label: "Usuários", href: "/admin/usuarios" },
      { label: "Tipos de afastamento", href: "/admin/afastamento-tipos" },
      { label: "Configurações", href: "/admin/configuracoes" },
    ],
  },
];
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run tests/unit/nav.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/nav.ts tests/unit/nav.test.ts
git commit -m "$(cat <<'EOF'
feat(lib): typed private top-nav config

Defines four groups (painel, afastamentos, ocorrencias, admin) with
typed submenu items. Admin group flagged adminOnly for filtering by
the AppTopNav server component in Phase 4.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Build `components/brand/logo-mark.tsx`

The square mark with the orange→blue gradient used in top-navs, auth cards, and the public footer. No unit test — visual component, matches the rest of `components/` (which has no React unit tests).

**Files:**
- Create: `components/brand/logo-mark.tsx`

- [ ] **Step 1: Create the file**

Create `components/brand/logo-mark.tsx`:

```tsx
import { cn } from "@/lib/utils";

type LogoMarkSize = "sm" | "md" | "lg";

interface LogoMarkProps {
  size?: LogoMarkSize;
  /** Render as muted-tone (used in footer / secondary contexts). */
  muted?: boolean;
  className?: string;
}

const sizeMap: Record<LogoMarkSize, { box: string; text: string }> = {
  sm: { box: "size-5 rounded-md", text: "text-[9px]" },
  md: { box: "size-7 rounded-lg", text: "text-xs" },
  lg: { box: "size-9 rounded-xl", text: "text-sm" },
};

export function LogoMark({ size = "md", muted = false, className }: LogoMarkProps) {
  const { box, text } = sizeMap[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid place-items-center font-extrabold text-white shrink-0",
        box,
        text,
        muted
          ? "bg-[var(--color-fg-muted)]"
          : "bg-[linear-gradient(135deg,var(--brand-accent-500)_0%,var(--brand-primary-600)_100%)]",
        className,
      )}
    >
      M
    </span>
  );
}
```

- [ ] **Step 2: Verify TypeScript and build**

Run: `npm run build`
Expected: build succeeds with no errors. (Tailwind v4 evaluates the arbitrary `bg-[…]` classes against the CSS variables added in Task 1.)

- [ ] **Step 3: Commit**

```bash
git add components/brand/logo-mark.tsx
git commit -m "$(cat <<'EOF'
feat(brand): LogoMark — gradient mark in three sizes

Square mark with orange→blue diagonal gradient, used in top-navs,
auth cards, and the public footer. Muted variant for secondary
contexts. Pure CSS-variable-driven so brand swaps in one place.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Build `components/brand/logo.tsx`

The full wordmark: mark + "MAIA · ENGEKO" with an accent-colored "·" separator. Three sizes, optional `muted` variant. Composes `<LogoMark>`.

**Files:**
- Create: `components/brand/logo.tsx`

- [ ] **Step 1: Create the file**

Create `components/brand/logo.tsx`:

```tsx
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo-mark";

type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  size?: LogoSize;
  /** Hides the "· ENGEKO" qualifier (for tight contexts). */
  productOnly?: boolean;
  /** Render in muted tone (used in footer). */
  muted?: boolean;
  className?: string;
}

const wordmarkSize: Record<LogoSize, string> = {
  sm: "text-sm gap-1.5",
  md: "text-[15px] gap-2",
  lg: "text-lg gap-2.5",
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
      <LogoMark size={size} muted={muted} />
      <span>
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
    </span>
  );
}
```

- [ ] **Step 2: Verify TypeScript and build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Quick visual smoke (optional but recommended)**

Temporarily import the Logo into `app/page.tsx` to eyeball it:

```tsx
// at the top:
import { Logo } from "@/components/brand/logo";

// somewhere in the JSX body of Home():
<div className="p-8 flex flex-col gap-4 items-start">
  <Logo size="sm" />
  <Logo size="md" />
  <Logo size="lg" />
  <Logo size="md" productOnly />
  <Logo size="md" muted />
</div>
```

Run: `npm run dev` and open `http://localhost:3000/`. Confirm:
- Three sizes render at increasing size.
- The orange→blue gradient is visible on the mark.
- The "·" between MAIA and ENGEKO is safety-orange.
- `productOnly` hides the qualifier.
- `muted` desaturates everything.

**Revert the smoke-test edit before committing.** The current `app/page.tsx` (Next.js starter) is going to be deleted in Phase 2 — do not commit any modification to it here.

- [ ] **Step 4: Commit**

```bash
git add components/brand/logo.tsx
git commit -m "$(cat <<'EOF'
feat(brand): Logo — MAIA·ENGEKO wordmark

Composes <LogoMark> with the wordmark; safety-orange "·" separator
between product and brand. productOnly hides the qualifier for tight
spots; muted variant for footer/secondary contexts.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Final phase verification + handoff

Confirm the foundation is solid and ready for Phase 2.

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 2: Full unit-test run**

Run: `npx vitest run`
Expected: ALL tests pass, including the new `public-links.test.ts` and `nav.test.ts`. Total ≥ 7 test files.

- [ ] **Step 3: Existing Playwright E2E**

Run: `npx playwright test --reporter=line`
Expected: existing E2E spec(s) pass. (Phase 1 doesn't touch any user-facing pages other than via token color shifts; happy-path login → painel should still work end-to-end.)

If the E2E suite is configured to need credentials or a deployed env that isn't available locally, skip this step and note it in the handoff comment. The Playwright config is in `playwright.config.ts`.

- [ ] **Step 4: Confirm no untracked files left in working tree**

Run: `git status`
Expected: working tree clean. (All commits from Tasks 1–6 should already be in `git log`.)

- [ ] **Step 5: Update the spec to mark Phase 1 complete**

Edit `docs/superpowers/specs/2026-05-14-frontend-redesign-design.md`. In Section 12, add a status line under "Phase 1 — Foundation":

```markdown
### Phase 1 — Foundation
**Status:** ✅ Complete (commit range: <first-sha>..<last-sha>)
```

Run `git log --oneline -10` to grab the SHA range. Commit:

```bash
git add docs/superpowers/specs/2026-05-14-frontend-redesign-design.md
git commit -m "docs(spec): mark Phase 1 (Foundation) complete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 6: Report to user**

Output a short status message:

> Phase 1 (Foundation) complete. Tokens replaced, 17 shadcn primitives installed, public-links + nav configs typed and seeded, LogoMark and Logo components built. Existing pages still render (only colors shifted slightly). Ready to plan Phase 2 (Public Surface) when you give the go-ahead.

---

## Self-review notes

**Spec coverage check:** This plan covers Phase 1 of the spec only.
- Section 4 (tokens) → Task 1 ✓
- Section 11 shadcn list → Task 2 ✓
- `lib/public-links.ts` → Task 3 ✓
- `lib/nav.ts` → Task 4 ✓
- `components/brand/logo-mark.tsx` → Task 5 ✓
- `components/brand/logo.tsx` → Task 6 ✓
- `.gitignore` entry for `.superpowers/` → already committed with the spec, not repeated here.

**Out of scope (next-phase plans):** Phases 2–5 each get their own plan document when the prior phase ships.

**Placeholder scan:** none.

**Type consistency:** `PublicLinkType`, `PublicLinkItem`, `PublicLinkGroup` in Task 3 are consumed by Phase 2 (not this plan). `AppNavGroup`, `AppNavItem`, `appNav` in Task 4 are consumed by Phase 4. `LogoMark`/`Logo` props in Tasks 5–6 used directly here and referenced from Phase 2+.
