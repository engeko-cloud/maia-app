# Post-Testing Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix route structure, RBAC, email CTAs, Fluig async, form validation, and stepper navigation identified in the first full manual test cycle.

**Architecture:** Route group `(app)` becomes the real URL segment `app/`, giving all admin-app routes a `/app/` prefix that cleanly separates them from public routes. RBAC uses the existing `Me` / `isInEquipe` model extended to the painel and nav layer. All other fixes are targeted — no architectural changes.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, Zod, React `cache()`, Vitest.

**Dependency order for parallel execution:**
- Task 1 → Task 2 (must be sequential, foundational)
- After Task 2, two parallel streams:
  - Stream A: Task 3 → Tasks 4, 5, 6 (RBAC)
  - Stream B: Tasks 7, 8, 9, 10 (independent bug fixes)

---

## Files created / modified

| File | Change |
|---|---|
| `app/app/` | New folder — entire `(app)/` tree moves here |
| `app/app/admin/layout.tsx` | Moved from `(admin)/admin/` (content updated) |
| `app/(admin)/` | Deleted |
| `middleware.ts` | Simplified to `/app/` prefix guard |
| `lib/nav.ts` | Add `requiredEquipe`, `/app/` prefix, Investigações sub-item |
| `lib/current-user.ts` | New — `cache()`-wrapped `getCurrentUser()` returning `Me` |
| `components/gates/equipe-only.tsx` | Update redirect from `/painel` to `/app/painel` |
| `components/layout/app-top-nav.tsx` | Filter groups by equipe |
| `app/app/layout.tsx` | Use `getCurrentUser()` |
| `app/app/painel/page.tsx` | Equipe-filtered KPIs + QuickActions |
| `app/app/afastamentos/[id]/page.tsx` | Add `requireEquipe('oh')` |
| `app/app/ocorrencias/[id]/page.tsx` | Add `requireEquipe('safety')` |
| `app/app/ocorrencias/[id]/investigacao/page.tsx` | Add `requireEquipe('safety')` |
| `app/api/public/afastamentos/route.ts` | Fix `baseUrl` |
| `app/api/public/ocorrencias/route.ts` | Fix `baseUrl` |
| `app/api/afastamentos/[id]/aprovar/route.ts` | Fluig async fire-and-forget + dev bypass |
| `lib/validation/ocorrencia.ts` | `dut` conditional on vitima presence |
| `components/forms/ocorrencia-form.tsx` | Conditional `dut` field |
| `components/detail/stepper.tsx` | Add `onStepClick` prop |
| `components/investigacoes/investigacao-form.tsx` | Wire stepper click |
| `app/(public)/investigacoes/editar/[token]/form.tsx` | Wire stepper click |
| All files with `/painel` / `/afastamentos` / `/ocorrencias` / `/admin` hrefs | Add `/app/` prefix |

---

## Task 1: Route rename + middleware

**Files:**
- Move: `app/(app)/` → `app/app/`
- Move: `app/(admin)/admin/layout.tsx` → `app/app/admin/layout.tsx`
- Delete: `app/(admin)/`
- Modify: `middleware.ts`

- [ ] **Step 1: Move `(app)` to `app`**

```bash
cp -r "app/(app)" "app/app"
rm -rf "app/(app)"
```

Verify the new structure:
```bash
find app/app -type f | sort
```
Expected: same files as before, now under `app/app/`.

- [ ] **Step 2: Move admin layout, delete `(admin)`**

```bash
cp "app/(admin)/admin/layout.tsx" "app/app/admin/layout.tsx"
cp "app/(admin)/admin/page.tsx" "app/app/admin/page.tsx"
rm -rf "app/(admin)"
```

- [ ] **Step 3: Update admin layout redirect**

Edit `app/app/admin/layout.tsx`. Change the redirect from `/painel` to `/app/painel`:

```ts
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
  if (!u?.administrador) redirect("/app/painel");

  return (
    <div className="min-h-screen bg-[var(--color-bg-subtle)] pb-14">
      <AppTopNav />
      <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-10">{children}</main>
      <AppFooter />
    </div>
  );
}
```

- [ ] **Step 4: Update `app/app/layout.tsx` redirect**

Edit `app/app/layout.tsx`. Change `redirect("/")` to `redirect("/app/painel")` for non-staff, and keep `redirect("/login")` for no user:

```ts
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

- [ ] **Step 5: Update `middleware.ts`**

Replace the current protected-prefixes logic with a single `/app/` check:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (path.startsWith("/app/") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|forms/|api/public/).*)"],
};
```

- [ ] **Step 6: Typecheck**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 0 (or only pre-existing errors unrelated to route structure).

- [ ] **Step 7: Commit**

```bash
git add app/app app/api middleware.ts
git commit -m "$(cat <<'EOF'
refactor(routes): rename (app) → app/, flatten (admin) group, simplify middleware

All admin-app routes now live under /app/ URL prefix. Middleware
protects /app/* with a single prefix check instead of a list.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Internal link updates

**Files:** All files containing old paths — full list in the table above under "all hrefs".

- [ ] **Step 1: Update `lib/nav.ts`**

Replace the entire file content:

```ts
export interface AppNavItem {
  label: string;
  href: string;
  icon?: string;
}

export interface AppNavGroup {
  id: "painel" | "afastamentos" | "ocorrencias" | "admin";
  label: string;
  href: string;
  items: AppNavItem[];
  adminOnly?: boolean;
  requiredEquipe?: "oh" | "safety";
}

export const appNav: AppNavGroup[] = [
  {
    id: "painel",
    label: "Painel",
    href: "/app/painel",
    items: [],
  },
  {
    id: "afastamentos",
    label: "Afastamentos",
    href: "/app/afastamentos",
    requiredEquipe: "oh",
    items: [
      { label: "Lista",      href: "/app/afastamentos" },
      { label: "Aprovações", href: "/app/afastamentos/aprovacoes" },
    ],
  },
  {
    id: "ocorrencias",
    label: "Ocorrências",
    href: "/app/ocorrencias",
    requiredEquipe: "safety",
    items: [
      { label: "Lista",          href: "/app/ocorrencias" },
      { label: "Investigações",  href: "/app/ocorrencias" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    href: "/app/admin",
    adminOnly: true,
    items: [],
  },
];
```

- [ ] **Step 2: Update `app-nav-row.tsx` active-state check**

In `components/layout/app-nav-row.tsx`, find the painel active check and update:

```ts
// Before
if (group.href === "/painel") return pathname === "/painel";
// After
if (group.href === "/app/painel") return pathname === "/app/painel";
```

- [ ] **Step 3: Update `components/gates/equipe-only.tsx`**

```ts
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function requireEquipe(codigo: "oh" | "safety") {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: usuario } = await supabase
    .from("usuarios").select("administrador").eq("id", user.id).single();
  if (usuario?.administrador) return user;

  const { data: m } = await supabase
    .from("equipe_usuarios").select("equipes!inner(codigo)").eq("usuario_id", user.id);
  const hasIt = (m ?? []).some((row: any) => row.equipes?.codigo === codigo);
  if (!hasIt) redirect("/app/painel");
  return user;
}
```

- [ ] **Step 4: Update `components/layout/app-user-pill.tsx`**

Find `href="/painel"` and change to `href="/app/painel"`.

- [ ] **Step 5: Update `components/layout/public-top-bar.tsx`**

Find `href="/painel"` and change to `href="/app/painel"`.

- [ ] **Step 6: Update `components/layout/public-mobile-menu.tsx`**

Find `href="/painel"` and change to `href="/app/painel"`.

- [ ] **Step 7: Update `components/home/private-shortcuts.tsx`**

Find `href="/painel"` and change to `href="/app/painel"`.

- [ ] **Step 8: Update `components/saude/saude-banner.tsx`**

Find `href="/painel/saude"` and change to `href="/app/painel/saude"`.

- [ ] **Step 9: Update `app/app/painel/page.tsx` hrefs**

Update all hrefs and `seeAllHref` inside the painel page:
- `href="/afastamentos/aprovacoes"` → `href="/app/afastamentos/aprovacoes"`
- `href="/afastamentos"` → `href="/app/afastamentos"`
- `href="/ocorrencias"` → `href="/app/ocorrencias"`
- `seeAllHref="/afastamentos"` → `seeAllHref="/app/afastamentos"`

- [ ] **Step 10: Update `app/app/painel/saude/page.tsx`**

Find `redirect("/painel")` → `redirect("/app/painel")`.

- [ ] **Step 11: Update afastamentos pages breadcrumbs**

`app/app/afastamentos/page.tsx`:
- `href="/painel"` → `href="/app/painel"`
- `basePath="/afastamentos"` → `basePath="/app/afastamentos"`

`app/app/afastamentos/aprovacoes/page.tsx`:
- `href="/painel"` → `href="/app/painel"`
- `href="/afastamentos"` → `href="/app/afastamentos"`

`app/app/afastamentos/[id]/page.tsx`:
- `{ label: "Painel", href: "/painel" }` → `{ label: "Painel", href: "/app/painel" }`
- `{ label: "Afastamentos", href: "/afastamentos" }` → `{ label: "Afastamentos", href: "/app/afastamentos" }`

- [ ] **Step 12: Update ocorrencias pages breadcrumbs**

`app/app/ocorrencias/page.tsx`:
- `href="/painel"` → `href="/app/painel"`
- `basePath="/ocorrencias"` → `basePath="/app/ocorrencias"`

`app/app/ocorrencias/[id]/page.tsx`:
- `{ label: "Painel", href: "/painel" }` → `{ label: "Painel", href: "/app/painel" }`
- `{ label: "Ocorrências", href: "/ocorrencias" }` → `{ label: "Ocorrências", href: "/app/ocorrencias" }`

`app/app/ocorrencias/[id]/investigacao/page.tsx`:
- `{ label: "Painel", href: "/painel" }` → `{ label: "Painel", href: "/app/painel" }`
- `{ label: "Ocorrências", href: "/ocorrencias" }` → `{ label: "Ocorrências", href: "/app/ocorrencias" }`

- [ ] **Step 13: Update `app/app/admin/page.tsx` hrefs**

In the `ITEMS` array, update the two non-admin hrefs:
- `href: "/painel/saude"` → `href: "/app/painel/saude"`
- All `href: "/admin/..."` → `href: "/app/admin/..."`

- [ ] **Step 14: Typecheck + run tests**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
npx vitest run 2>&1 | tail -5
```
Expected: 0 TS errors, 156/156 tests pass.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(links): update all internal hrefs to /app/ prefix

nav.ts, breadcrumbs, redirects, public shortcuts all updated.
requiredEquipe field added to nav groups for RBAC (used in Task 6).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `getCurrentUser` helper

**Files:**
- Create: `lib/current-user.ts`

- [ ] **Step 1: Create the helper**

Create `lib/current-user.ts`:

```ts
import { cache } from "react";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Me } from "@/lib/permissions";

/**
 * Returns the current authenticated user with their equipe codes.
 * React cache() deduplicates this per request — safe to call from
 * layout AND page in the same render tree.
 */
export const getCurrentUser = cache(async (): Promise<Me | null> => {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("usuarios")
    .select("id, administrador, equipe_usuarios(equipes(codigo))")
    .eq("id", user.id)
    .single();

  if (!data) return null;

  const equipes = ((data.equipe_usuarios ?? []) as Array<{ equipes: { codigo: string } | null }>)
    .map((eu) => eu.equipes?.codigo)
    .filter((c): c is string => Boolean(c));

  return {
    id: user.id,
    administrador: data.administrador ?? false,
    equipes,
  };
});
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/current-user.ts
git commit -m "$(cat <<'EOF'
feat(auth): getCurrentUser helper — cached Me with equipes per request

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Detail page guards

**Files:**
- Modify: `app/app/afastamentos/[id]/page.tsx`
- Modify: `app/app/ocorrencias/[id]/page.tsx`
- Modify: `app/app/ocorrencias/[id]/investigacao/page.tsx`

- [ ] **Step 1: Guard `afastamentos/[id]`**

Open `app/app/afastamentos/[id]/page.tsx`. Add at the top of the default export function, before the DB query:

```ts
import { requireEquipe } from "@/components/gates/equipe-only";

export default async function AfastamentoDetailPage({ params }: ...) {
  await requireEquipe("oh");   // ← add this line first
  // ... rest of existing code
```

- [ ] **Step 2: Guard `ocorrencias/[id]`**

Open `app/app/ocorrencias/[id]/page.tsx`. Add at the top:

```ts
import { requireEquipe } from "@/components/gates/equipe-only";

export default async function OcorrenciaDetailPage({ params }: ...) {
  await requireEquipe("safety");   // ← add this line first
  // ... rest of existing code
```

- [ ] **Step 3: Guard `ocorrencias/[id]/investigacao`**

Open `app/app/ocorrencias/[id]/investigacao/page.tsx`. Add at the top:

```ts
import { requireEquipe } from "@/components/gates/equipe-only";

export default async function InvestigacaoPage({ params }: ...) {
  await requireEquipe("safety");   // ← add this line first
  // ... rest of existing code
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/app/afastamentos/\[id\]/page.tsx app/app/ocorrencias/\[id\]/page.tsx app/app/ocorrencias/\[id\]/investigacao/page.tsx
git commit -m "$(cat <<'EOF'
feat(auth): equipe guards on detail routes — OH for afastamentos, safety for ocorrencias

Non-equipe users redirected to /app/painel instead of 404.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Painel equipe-filtered KPIs + QuickActions

**Files:**
- Modify: `app/app/painel/page.tsx`

- [ ] **Step 1: Replace the painel page with equipe-aware version**

Replace the entire content of `app/app/painel/page.tsx`:

```tsx
import {
  CheckCircle2Icon,
  FileEditIcon,
  ListChecksIcon,
  AlertTriangleIcon,
  SearchIcon,
} from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { isInEquipe } from "@/lib/permissions";
import { greetingFor } from "@/lib/greeting";
import { PainelHero } from "@/components/painel/painel-hero";
import { QuickAction } from "@/components/painel/quick-action";
import { KpiCard } from "@/components/painel/kpi-card";
import { ActivityFeed, type ActivityFeedRow } from "@/components/painel/activity-feed";
import { SaudeBanner } from "@/components/saude/saude-banner";

interface EventoRow {
  id: string;
  tipo_entidade: ActivityFeedRow["tipo_entidade"];
  entidade_id: string;
  evento: ActivityFeedRow["evento"];
  ocorrido_em: string;
  usuarios: { nome: string | null; sobrenome: string | null } | null;
}

export default async function PainelPage() {
  const supabase = await getSupabaseServer();
  const me = await getCurrentUser();

  const showOh     = isInEquipe(me, "oh");
  const showSafety = isInEquipe(me, "safety");

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { data: usuario } = await supabase
    .from("usuarios").select("nome").eq("id", authUser!.id).single();
  const firstName = (usuario?.nome?.trim() || "").split(/\s+/)[0] || "Usuário";

  const [pendentesRes, ativosRes, ocorrenciasAbertasRes, recentesRes] = await Promise.all([
    showOh
      ? supabase.from("afastamentos").select("id", { count: "exact", head: true }).eq("situacao", "pendente")
      : Promise.resolve({ count: 0 }),
    showOh
      ? supabase.from("afastamentos").select("id", { count: "exact", head: true }).in("situacao", ["aprovado", "em_andamento"])
      : Promise.resolve({ count: 0 }),
    showSafety
      ? supabase.from("ocorrencias").select("id", { count: "exact", head: true }).eq("situacao", "aberta")
      : Promise.resolve({ count: 0 }),
    supabase
      .from("eventos")
      .select("id, tipo_entidade, entidade_id, evento, ocorrido_em, usuarios:autor_id(nome, sobrenome)")
      .order("ocorrido_em", { ascending: false })
      .limit(5)
      .returns<EventoRow[]>(),
  ]);

  const pendentes          = pendentesRes.count ?? 0;
  const ativos             = ativosRes.count ?? 0;
  const ocorrenciasAbertas = ocorrenciasAbertasRes.count ?? 0;

  const recentes: ActivityFeedRow[] = (recentesRes.data ?? []).map((row) => ({
    id: row.id,
    tipo_entidade: row.tipo_entidade,
    entidade_id: row.entidade_id,
    evento: row.evento,
    ocorrido_em: row.ocorrido_em,
    autor_nome: [row.usuarios?.nome, row.usuarios?.sobrenome].filter(Boolean).join(" ") || null,
  }));

  const now = new Date();
  const greeting = greetingFor(now.getHours());
  const formattedDate = now.toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });

  const heroHeadline = showOh && pendentes > 0
    ? `${pendentes} ${pendentes === 1 ? "aprovação aguardando" : "aprovações aguardando"} sua revisão.`
    : showSafety && ocorrenciasAbertas > 0
    ? `${ocorrenciasAbertas} ${ocorrenciasAbertas === 1 ? "ocorrência aberta" : "ocorrências abertas"} aguardando investigação.`
    : "Nada pendente — tudo em dia.";

  const heroSub = showOh && pendentes > 0
    ? "Revise as solicitações pendentes antes do fim do dia para manter o fluxo."
    : "Acompanhe as atividades pelos cartões abaixo.";

  return (
    <div className="space-y-6">
      <SaudeBanner />
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">Painel</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{greeting}, {firstName}.</p>
        </div>
        <p className="font-mono text-xs text-[var(--color-fg-subtle)] first-letter:uppercase">{formattedDate}</p>
      </header>

      <PainelHero
        headline={heroHeadline}
        sub={heroSub}
        cta={showOh && pendentes > 0 ? { href: "/app/afastamentos/aprovacoes", label: "Ver aprovações" } : undefined}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {showOh && (
            <>
              <QuickAction href="/app/afastamentos/aprovacoes" icon={CheckCircle2Icon} title="Aprovações" sub="Revisar afastamentos pendentes" tone="primary" count={pendentes} />
              <QuickAction href="/app/afastamentos" icon={ListChecksIcon} title="Afastamentos" sub="Lista completa" tone="accent" />
            </>
          )}
          {showSafety && (
            <>
              <QuickAction href="/app/ocorrencias" icon={AlertTriangleIcon} title="Ocorrências" sub="Aberturas e investigações" tone="accent" />
              <QuickAction href="/app/ocorrencias" icon={SearchIcon} title="Investigações" sub="Em andamento e aprovação" tone="accent" />
            </>
          )}
          <QuickAction href="/forms/afastamentos" icon={FileEditIcon} title="Novo afastamento" sub="Formulário público" tone="accent" />
          {showSafety && (
            <QuickAction href="/forms/ocorrencias" icon={AlertTriangleIcon} title="Nova ocorrência" sub="Formulário público" tone="accent" />
          )}
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {showOh && (
              <KpiCard label="Afastamentos ativos" value={ativos} delta={ativos === 0 ? "—" : `${ativos} em curso`} tone="primary" />
            )}
            {showSafety && (
              <KpiCard label="Ocorrências abertas" value={ocorrenciasAbertas} delta={ocorrenciasAbertas === 0 ? "—" : `${ocorrenciasAbertas} aguardando investigação`} tone="accent" />
            )}
          </div>
          <ActivityFeed rows={recentes} seeAllHref={showOh ? "/app/afastamentos" : "/app/ocorrencias"} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/app/painel/page.tsx
git commit -m "$(cat <<'EOF'
feat(painel): equipe-filtered KPIs and QuickAction cards

OH sees afastamentos domain; safety sees ocorrencias domain; admins see both.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Nav equipe filtering

**Files:**
- Modify: `components/layout/app-top-nav.tsx`

- [ ] **Step 1: Update `AppTopNav` to filter by equipe**

Replace the content of `components/layout/app-top-nav.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { AppNavRow } from "@/components/layout/app-nav-row";
import { AppUserPill } from "@/components/layout/app-user-pill";
import { AppNotificationBell } from "@/components/layout/app-notification-bell";
import { appNav } from "@/lib/nav";
import { getCurrentUser } from "@/lib/current-user";
import { isInEquipe } from "@/lib/permissions";
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

  const me = await getCurrentUser();

  const { data: row } = await supabase
    .from("usuarios")
    .select("nome")
    .eq("id", authUser.id)
    .single();

  const nome = row?.nome?.trim() ?? "";
  const firstName = nome ? nome.split(/\s+/)[0]! : "Usuário";
  const initials = deriveInitials(nome || firstName);

  const groups = appNav.filter((g) => {
    if (g.adminOnly) return me?.administrador === true;
    if (g.requiredEquipe) return isInEquipe(me, g.requiredEquipe);
    return true;
  });

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="relative mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" aria-label="Início" className="shrink-0">
          <Logo size="md" />
        </Link>

        <AppNavRow groups={groups} />

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

- [ ] **Step 2: Typecheck + tests**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
npx vitest run 2>&1 | tail -5
```
Expected: 0 TS errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/layout/app-top-nav.tsx
git commit -m "$(cat <<'EOF'
feat(nav): equipe-filtered nav groups — OH sees afastamentos, safety sees ocorrencias

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Base URL fix

**Files:**
- Modify: `app/api/public/afastamentos/route.ts`
- Modify: `app/api/public/ocorrencias/route.ts`

- [ ] **Step 1: Fix `afastamentos/route.ts`**

In `app/api/public/afastamentos/route.ts`, find:
```ts
const baseUrl = process.env.APP_URL ?? "";
```
Replace with:
```ts
const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "http://localhost:3000";
```

- [ ] **Step 2: Fix `ocorrencias/route.ts`**

In `app/api/public/ocorrencias/route.ts`, find:
```ts
const baseUrl = process.env.APP_URL ?? "";
```
Replace with:
```ts
const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "http://localhost:3000";
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "error TS" | head -5
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/public/afastamentos/route.ts app/api/public/ocorrencias/route.ts
git commit -m "$(cat <<'EOF'
fix(email): standardize baseUrl to NEXT_PUBLIC_APP_BASE_URL ?? APP_URL ?? localhost

Fixes broken email CTAs where baseUrl was empty string.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Fluig async fire-and-forget + dev bypass

**Files:**
- Modify: `app/api/afastamentos/[id]/aprovar/route.ts`

- [ ] **Step 1: Read the current file**

Run: `cat app/api/afastamentos/\[id\]/aprovar/route.ts`

Identify:
1. The block that calls `await pushToFluig(...)` (around lines 41–84)
2. The DB update block (`situacao = "finalizado"`) that follows
3. The email send block that follows

- [ ] **Step 2: Refactor to async fire-and-forget**

The approval route must return `200` before Fluig responds. The new flow:

1. Validate request (sync)
2. Fetch afastamento data (sync)
3. Update `situacao = "finalizado"` + `decidido_por` + `decidido_em` (sync)
4. Log `aprovado` evento (sync)
5. Send approval email (sync)
6. Return `200` to client
7. Fire Fluig non-blocking (after response)

Replace the Fluig block. Find the section from the Fluig guard condition to the final `return NextResponse.json({ ok: true })` and restructure it so the DB update, evento log, and email send happen **before** the return, and Fluig fires **after**:

```ts
  // --- Sync: update status, log, email ---
  const now = new Date().toISOString();
  const { error: upErr } = await admin
    .from("afastamentos")
    .update({
      situacao:       "finalizado",
      decidido_por:   user.id,
      decidido_em:    now,
      enviado_fluig_em: null,   // will be set by async Fluig block if successful
    })
    .eq("id", id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await writeEvento(admin, { evento: "aprovado", tipoEntidade: "afastamento", entidadeId: id, autorId: user.id });

  // ... existing email send code here (approval email to recipient) ...

  // --- Async: Fluig fire-and-forget ---
  if (full.afastamento_tipos?.requer_aprovacao) {
    void (async () => {
      try {
        if (process.env.NODE_ENV !== "production") {
          await writeEvento(admin, {
            evento: "fluig_enviado", tipoEntidade: "afastamento", entidadeId: id,
            autorId: user.id, dados: { dev_bypass: true },
          });
          return;
        }
        const result = await pushToFluig({
          afastamento_id:       id,
          tipo_codigo:          full.afastamento_tipos.codigo,
          cpf:                  full.cpf ?? "",
          data_inicio:          full.data_inicio,
          data_fim:             full.data_fim ?? full.data_inicio,
          duracao_dias:         full.duracao_dias ?? 1,
          cid:                  full.cid ?? "",
          arquivo_url:          full.arquivo_url ?? "",
          empresa_codigo_fluig: (full.empresas as any).codigo_fluig ?? "",
        });
        if (result?.ok) {
          await admin.from("afastamentos").update({ enviado_fluig_em: new Date().toISOString() }).eq("id", id);
          await writeEvento(admin, {
            evento: "fluig_enviado", tipoEntidade: "afastamento", entidadeId: id,
            autorId: user.id, dados: { response: result.response },
          });
        } else {
          await writeEvento(admin, {
            evento: "fluig_erro", tipoEntidade: "afastamento", entidadeId: id,
            autorId: user.id, dados: result,
          });
        }
      } catch (err: unknown) {
        await writeEvento(admin, {
          evento: "fluig_erro", tipoEntidade: "afastamento", entidadeId: id,
          autorId: user.id, dados: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    })();
  }

  return NextResponse.json({ ok: true });
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/afastamentos/\[id\]/aprovar/route.ts
git commit -m "$(cat <<'EOF'
feat(fluig): async fire-and-forget — approval no longer blocked by Fluig

Dev bypass logs fluig_enviado with dev_bypass:true instead of calling edge fn.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Form validation — `dut` conditional on vítima

**Files:**
- Modify: `lib/validation/ocorrencia.ts`
- Modify: `components/forms/ocorrencia-form.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/unit/ocorrencia-validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { OcorrenciaInputSchema } from "@/lib/validation/ocorrencia";

const BASE = {
  empresa_id:      "00000000-0000-0000-0000-000000000001",
  unidade_id:      "00000000-0000-0000-0000-000000000002",
  tipo:            "acidente",
  data_ocorrencia: "2026-05-17",
  email_remetente: "test@example.com",
  descricao:       "Descrição com pelo menos dez caracteres aqui.",
};

describe("OcorrenciaInputSchema — dut validation", () => {
  it("accepts form without vítima and without dut", () => {
    expect(() => OcorrenciaInputSchema.parse(BASE)).not.toThrow();
  });

  it("requires dut when relacao_vitima is set", () => {
    const result = OcorrenciaInputSchema.safeParse({
      ...BASE,
      relacao_vitima: "colaborador",
      // dut omitted
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("dut"))).toBe(true);
    }
  });

  it("accepts form with relacao_vitima and dut", () => {
    expect(() =>
      OcorrenciaInputSchema.parse({
        ...BASE,
        relacao_vitima: "colaborador",
        dut: "2026-05-16",
      })
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/unit/ocorrencia-validation.test.ts 2>&1 | tail -10
```
Expected: FAIL — "requires dut when relacao_vitima is set" fails because the current schema doesn't enforce this.

- [ ] **Step 3: Add `superRefine` to schema**

In `lib/validation/ocorrencia.ts`, add `.superRefine()` after the closing `})`:

```ts
export const OcorrenciaInputSchema = z.object({
  // ... all existing fields unchanged ...
}).superRefine((val, ctx) => {
  if (val.relacao_vitima && !val.dut) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dut"],
      message: "Último dia trabalhado obrigatório quando há vítima.",
    });
  }
});
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run tests/unit/ocorrencia-validation.test.ts 2>&1 | tail -5
```
Expected: 3/3 pass.

- [ ] **Step 5: Make `dut` field conditional in the form**

In `components/forms/ocorrencia-form.tsx`, read the file and find where the `dut` field is rendered. Wrap it so it only renders when `relacaoVitima` is truthy.

The component already watches `relacaoVitima` (line 98: `const relacaoVitima = form.watch("relacao_vitima")`). Find the JSX for the `dut` field and wrap it:

```tsx
{relacaoVitima && (
  <div>
    {/* existing dut field JSX */}
  </div>
)}
```

Also ensure the submit cleanup in the handler clears `dut` when there is no `relacao_vitima`:

In the submit handler's cleanup object (around line 146), add:
```ts
...(!values.relacao_vitima ? { dut: undefined } : {}),
```

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run 2>&1 | tail -5
```
Expected: all tests pass (including the new 3).

- [ ] **Step 7: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | head -5
```
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add lib/validation/ocorrencia.ts components/forms/ocorrencia-form.tsx tests/unit/ocorrencia-validation.test.ts
git commit -m "$(cat <<'EOF'
fix(form): dut field required only when relacao_vitima is set

Adds superRefine to OcorrenciaInputSchema and conditional rendering in form.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Stepper click navigation

**Files:**
- Modify: `components/detail/stepper.tsx`
- Modify: `components/investigacoes/investigacao-form.tsx`
- Modify: `app/(public)/investigacoes/editar/[token]/form.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/unit/stepper.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Stepper } from "@/components/detail/stepper";

const steps = [
  { label: "Ishikawa" },
  { label: "Plano" },
  { label: "Participantes" },
  { label: "Fotos" },
];

describe("Stepper", () => {
  it("calls onStepClick with correct index when step is clicked", () => {
    const handler = vi.fn();
    render(<Stepper current={2} steps={steps} onStepClick={handler} />);
    fireEvent.click(screen.getByLabelText("Ir para etapa Plano"));
    expect(handler).toHaveBeenCalledWith(1);
  });

  it("does not render buttons when onStepClick is not provided", () => {
    render(<Stepper current={1} steps={steps} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/unit/stepper.test.tsx 2>&1 | tail -10
```
Expected: FAIL — Stepper doesn't render buttons.

- [ ] **Step 3: Update `Stepper` component**

Replace the content of `components/detail/stepper.tsx`:

```tsx
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperStep {
  label: string;
}

interface StepperProps {
  steps: StepperStep[];
  current: number;
  /** When provided, step indicators become clickable buttons. */
  onStepClick?: (index: number) => void;
}

export function Stepper({ steps, current, onStepClick }: StepperProps) {
  return (
    <ol className="flex items-center gap-2" aria-label="Etapas">
      {steps.map((s, i) => {
        const done   = i < current;
        const active = i === current;

        const indicator = (
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
              done   && "bg-[var(--color-success)] text-white",
              active && "bg-[var(--brand-primary-600)] text-white",
              !done && !active && "bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]",
            )}
          >
            {done ? <CheckIcon className="size-4" aria-hidden="true" /> : i + 1}
          </span>
        );

        return (
          <li key={s.label} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
            {onStepClick ? (
              <button
                type="button"
                aria-label={`Ir para etapa ${s.label}`}
                onClick={() => onStepClick(i)}
                className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary-600)] rounded-full"
              >
                {indicator}
              </button>
            ) : indicator}

            <span
              className={cn(
                "relative flex-1 truncate text-sm",
                active ? "font-semibold text-foreground" : "text-[var(--color-fg-muted)]",
              )}
            >
              {s.label}
              {active && (
                <span aria-hidden="true" className="absolute -bottom-1 left-0 h-[2px] w-8 bg-[var(--brand-accent-500)]" />
              )}
            </span>

            {i < steps.length - 1 && (
              <span aria-hidden="true" className="h-px flex-1 bg-[var(--color-border)]" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run tests/unit/stepper.test.tsx 2>&1 | tail -5
```
Expected: 2/2 pass.

- [ ] **Step 5: Wire `onStepClick` in admin `InvestigacaoForm`**

In `components/investigacoes/investigacao-form.tsx`, find the `<Stepper>` usage and add the `onStepClick` prop:

```tsx
<Stepper
  current={step}
  steps={STEP_LABELS.map((s) => ({ label: s }))}
  onStepClick={(i) => {
    if (i === 0 || gatePassesUpTo(dados, i - 1)) setStep(i);
  }}
/>
```

Add the import at the top if not already present:
```ts
import { gatePassesUpTo } from "@/lib/investigacao-step-gates";
```

- [ ] **Step 6: Wire `onStepClick` in public form**

In `app/(public)/investigacoes/editar/[token]/form.tsx`, find the `<Stepper>` usage and add:

```tsx
<Stepper
  current={step}
  steps={STEP_LABELS.map((s) => ({ label: s }))}
  onStepClick={readOnly ? undefined : (i) => {
    if (i === 0 || gatePassesUpTo(dados, i - 1)) setStep(i);
  }}
/>
```

Add the import if not present:
```ts
import { gatePassesUpTo } from "@/lib/investigacao-step-gates";
```

- [ ] **Step 7: Run full test suite + typecheck**

```bash
npx vitest run 2>&1 | tail -5
npx tsc --noEmit 2>&1 | grep "error TS" | head -5
```
Expected: all tests pass, 0 TS errors.

- [ ] **Step 8: Commit**

```bash
git add components/detail/stepper.tsx components/investigacoes/investigacao-form.tsx app/\(public\)/investigacoes tests/unit/stepper.test.tsx
git commit -m "$(cat <<'EOF'
feat(stepper): clickable step indicators — navigate to any reachable step

onStepClick prop renders buttons; gate check prevents jumping to locked steps.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

After all tasks complete:

```bash
cd /Users/heizen/DEV/maia-app
npx vitest run 2>&1 | tail -5
npx tsc --noEmit 2>&1 | grep "error TS" | head -5
```

Expected: all tests pass, 0 TS errors.

**Manual smoke test checklist:**
- [ ] Login with `admin@seed.local` → lands on `/app/painel`, sees both KPI pairs, both nav groups
- [ ] Login with `oh@seed.local` → sees only Afastamentos in nav, only OH KPIs on painel
- [ ] Login with `safety@seed.local` → sees only Ocorrências in nav, only safety KPIs on painel
- [ ] OH user navigates to `/app/afastamentos/[id]` → sees page (not 404)
- [ ] OH user navigates to `/app/ocorrencias/[id]` → redirected to `/app/painel`
- [ ] Submit an ocorrência without "vítima" selected → `dut` field hidden, form submits without it
- [ ] Submit an ocorrência with "vítima" selected and no `dut` → validation error on `dut`
- [ ] Approve an afastamento in dev → returns immediately, eventos log shows `fluig_enviado` with `dev_bypass: true`
- [ ] Confirm email CTAs in afastamento and ocorrência receipts contain full `http://localhost:3000/...` URLs
- [ ] Stepper steps are clickable — clicking step 0 always works; clicking step 2 requires steps 0–1 to pass
