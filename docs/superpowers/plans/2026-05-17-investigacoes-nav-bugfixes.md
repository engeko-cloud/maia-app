# Investigações Nav + Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken admin-route links in components, fix "Iniciar investigação" showing for existing open investigations, add a dedicated Investigações list page, and fix the Supabase realtime crash in the notification hook.

**Architecture:** Four targeted fixes in the admin app. Tasks 1–2 are pure bug fixes (link strings + one conditional). Task 3 is a new server-component page following the existing `aprovacoes/page.tsx` pattern. Task 4 fixes the realtime double-subscribe crash. All tasks are independent and can be done in any order after reading the plan.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, Vitest.

---

## Files created / modified

| File | Change |
|---|---|
| `components/investigacoes/investigation-status.tsx` | Fix 3× admin hrefs + "Iniciar" label condition |
| `components/investigacoes/investigacao-summary.tsx` | Fix 1× admin href |
| `components/afastamentos/aprovacoes-panel.tsx` | Fix 1× admin href |
| `components/saude/saude-client.tsx` | Fix 1× admin href |
| `app/app/investigacoes/page.tsx` | New — Investigações list page |
| `lib/nav.ts` | Update Investigações sub-item href |
| `app/app/painel/page.tsx` | Update Investigações QuickAction href |
| `hooks/use-notifications.ts` | Fix realtime double-subscribe crash |

---

## Task 1: Fix broken admin-route links + "Iniciar" label

**Files:**
- Modify: `components/investigacoes/investigation-status.tsx`
- Modify: `components/investigacoes/investigacao-summary.tsx`
- Modify: `components/afastamentos/aprovacoes-panel.tsx`
- Modify: `components/saude/saude-client.tsx`

- [ ] **Step 1: Fix `investigation-status.tsx` — 3 hrefs + 1 label**

Open `components/investigacoes/investigation-status.tsx`. Make these 4 changes:

**Change 1** (line ~47 — em_aprovacao block):
```tsx
// Before
<Link href={`/ocorrencias/${ocorrenciaId}/investigacao`}>
// After
<Link href={`/app/ocorrencias/${ocorrenciaId}/investigacao`}>
```

**Change 2** (line ~73 — rejeitada block):
```tsx
// Before
<Link href={`/ocorrencias/${ocorrenciaId}/investigacao`}>
// After
<Link href={`/app/ocorrencias/${ocorrenciaId}/investigacao`}>
```

**Change 3** (line ~106 — em_andamento block):
```tsx
// Before
<Link href={`/ocorrencias/${ocorrenciaId}/investigacao`}>
// After
<Link href={`/app/ocorrencias/${ocorrenciaId}/investigacao`}>
```

**Change 4** (line ~107 — button label, same em_andamento block):
```tsx
// Before
<Button>{isEmpty ? "Iniciar investigação" : "Continuar investigação"}</Button>
// After
<Button>{investigacao === null ? "Iniciar investigação" : "Continuar investigação"}</Button>
```

The `/ocorrencias/relatorio/${token}` links in this file are **public routes** — do NOT change them.

- [ ] **Step 2: Fix `investigacao-summary.tsx` — 1 href**

Open `components/investigacoes/investigacao-summary.tsx`. Find the "Ver investigação" link:
```tsx
// Before
<Link href={`/ocorrencias/${ocorrenciaId}/investigacao`}>
// After
<Link href={`/app/ocorrencias/${ocorrenciaId}/investigacao`}>
```

- [ ] **Step 3: Fix `aprovacoes-panel.tsx` — 1 href**

Open `components/afastamentos/aprovacoes-panel.tsx`. Find the row link (around line 64):
```tsx
// Before
href={`/afastamentos/${p.id}`}
// After
href={`/app/afastamentos/${p.id}`}
```

- [ ] **Step 4: Fix `saude-client.tsx` — 1 href**

Open `components/saude/saude-client.tsx`. Find the afastamento row link (around line 32):
```tsx
// Before
href={`/afastamentos/${item.id}`}
// After
href={`/app/afastamentos/${item.id}`}
```

- [ ] **Step 5: Verify no old-style template-literal hrefs remain**

```bash
cd /Users/heizen/DEV/maia-app
grep -rn '`/afastamentos/\|`/ocorrencias/' components --include="*.tsx" | grep -v "relatorio\|status\|token\|editar\|forms" | grep -v node_modules
```

Expected: 0 results (all admin-route template hrefs are now prefixed with `/app/`).

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add components/investigacoes/investigation-status.tsx \
        components/investigacoes/investigacao-summary.tsx \
        components/afastamentos/aprovacoes-panel.tsx \
        components/saude/saude-client.tsx
git commit -m "$(cat <<'EOF'
fix(links): add /app/ prefix to admin-route template hrefs in components

investigation-status (×3), investigacao-summary, aprovacoes-panel,
saude-client. Also fix "Iniciar" label shown for existing investigacoes.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Investigações list page + nav updates

**Files:**
- Create: `app/app/investigacoes/page.tsx`
- Modify: `lib/nav.ts`
- Modify: `app/app/painel/page.tsx`

- [ ] **Step 1: Create `app/app/investigacoes/page.tsx`**

```tsx
import Link from "next/link";
import { requireEquipe } from "@/components/gates/equipe-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { StatusPill } from "@/components/data/status-pill";
import { EmptyState } from "@/components/data/empty-state";
import { SearchIcon } from "lucide-react";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";
import { investigacaoSituacaoLabel } from "@/lib/investigacao-state";

interface InvestigacaoRow {
  id: string;
  situacao: string;
  ocorrencias: {
    id: string;
    tipo: string;
    data_ocorrencia: string;
    empresas: { nome: string } | null;
  } | null;
}

export default async function InvestigacoesPage() {
  await requireEquipe("safety");
  const supabase = await getSupabaseServer();

  const { data } = await supabase
    .from("investigacoes")
    .select("id, situacao, ocorrencias!inner(id, tipo, data_ocorrencia, empresas!inner(nome))")
    .order("criado_em", { ascending: false })
    .limit(200)
    .returns<InvestigacaoRow[]>();

  const rows = data ?? [];

  const columns: DataTableColumn<InvestigacaoRow>[] = [
    {
      key: "tipo",
      label: "Tipo",
      render: (r) => ocorrenciaTipoLabel(r.ocorrencias?.tipo ?? ""),
    },
    {
      key: "empresa",
      label: "Empresa",
      render: (r) => r.ocorrencias?.empresas?.nome ?? "—",
    },
    {
      key: "data",
      label: "Data ocorrência",
      mono: true,
      render: (r) =>
        r.ocorrencias
          ? new Date(r.ocorrencias.data_ocorrencia).toLocaleDateString("pt-BR")
          : "—",
    },
    {
      key: "situacao",
      label: "Situação",
      render: (r) => <StatusPill domain="investigacao" situacao={r.situacao} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/app/painel" className="hover:text-foreground">Painel</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">Investigações</span>
        </nav>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Investigações</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          {rows.length} registro{rows.length === 1 ? "" : "s"}
        </p>
      </header>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        getRowHref={(r) => r.ocorrencias ? `/app/ocorrencias/${r.ocorrencias.id}` : "#"}
        empty={
          <EmptyState
            icon={SearchIcon}
            title="Nenhuma investigação"
            description="As investigações aparecem aqui quando uma ocorrência é registrada."
          />
        }
      />
    </div>
  );
}
```

- [ ] **Step 2: Update `lib/nav.ts` — Investigações href**

In `lib/nav.ts`, find the Ocorrências group's Investigações sub-item:
```ts
// Before
{ label: "Investigações", href: "/app/ocorrencias" },
// After
{ label: "Investigações", href: "/app/investigacoes" },
```

- [ ] **Step 3: Update `app/app/painel/page.tsx` — Investigações QuickAction**

In `app/app/painel/page.tsx`, find the Investigações QuickAction:
```tsx
// Before
<QuickAction href="/app/ocorrencias" icon={SearchIcon} title="Investigações" ... />
// After
<QuickAction href="/app/investigacoes" icon={SearchIcon} title="Investigações" ... />
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/app/investigacoes/page.tsx lib/nav.ts app/app/painel/page.tsx
git commit -m "$(cat <<'EOF'
feat(investigacoes): dedicated list page + nav and painel links updated

Row click navigates to the ocorrencia detail (same pair as aprovacoes→afastamento).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Fix realtime notification crash

**Files:**
- Modify: `hooks/use-notifications.ts`

- [ ] **Step 1: Fix `hooks/use-notifications.ts`**

Open `hooks/use-notifications.ts`. Replace the realtime `useEffect` with a version that uses a unique channel name per mount:

```ts
// Realtime subscription — unique name avoids Supabase singleton channel reuse on remount
React.useEffect(() => {
  const supabase = getSupabaseBrowser();
  const channelName = `notifications-${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "eventos",
        filter: "tipo_entidade=in.(afastamento,ocorrencia)",
      },
      (payload) => {
        const row = payload.new as {
          id: string;
          tipo_entidade: string;
          evento: string;
          ocorrido_em: string;
        };
        setItems((prev) => [
          {
            id: row.id,
            tipo_entidade: row.tipo_entidade as Notification["tipo_entidade"],
            evento: row.evento,
            ocorrido_em: row.ocorrido_em,
            lido: false,
          },
          ...prev,
        ]);
      },
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);
```

The only change from the original is `"notifications"` → a unique `channelName` computed inline. The Supabase client is a singleton; calling `.channel("notifications")` twice returns the same already-subscribed instance in React Strict Mode. A fresh name forces a new channel object each time.

- [ ] **Step 2: Typecheck**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```
Expected: 0 errors.

- [ ] **Step 3: Run tests**

```bash
npx vitest run 2>&1 | tail -5
```
Expected: 159/159 pass.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-notifications.ts
git commit -m "$(cat <<'EOF'
fix(realtime): unique channel name per mount — prevents double-subscribe crash

Supabase client is a singleton; channel("notifications") returns the same
already-subscribed instance on React Strict Mode remount. Fresh name each time.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

```bash
cd /Users/heizen/DEV/maia-app
npx vitest run 2>&1 | tail -5
npx tsc --noEmit 2>&1 | grep "error TS" | head -5
```

Expected: all tests pass, 0 TS errors.

**Manual smoke checklist:**
- [ ] Login as safety user → Investigações appears in top nav → navigates to `/app/investigacoes`
- [ ] `/app/investigacoes` lists rows → clicking a row navigates to `/app/ocorrencias/[id]`
- [ ] Painel → Investigações QuickAction → navigates to `/app/investigacoes`
- [ ] Ocorrência with `em_andamento` investigação that has no dados yet → shows "Continuar investigação" (not "Iniciar")
- [ ] Ocorrência with no investigação → shows "Iniciar investigação"
- [ ] "Revisar agora" / "Ajustar investigação" / "Continuar investigação" buttons navigate to `/app/ocorrencias/[id]/investigacao` (not 404)
- [ ] Aprovações list → clicking a row navigates to `/app/afastamentos/[id]`
- [ ] Saúde → afastamento error rows link to `/app/afastamentos/[id]`
- [ ] No realtime crash in browser console when opening any admin page
