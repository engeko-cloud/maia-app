# AfastamentoHistoryCard + CID Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 60-day history card with export shortcut to the afastamento detail page, and add a CID column to both the app and portal afastamentos lists.

**Architecture:** `AfastamentoHistoryCard` is an async server component that fetches its own Supabase data (same request context as the parent page), wrapped in `<Suspense>`. `ExportHistoryButton` is a minimal client component that fires a direct POST to `/api/relatorios/afastamentos` with only `cpf`. The CID additions are pure query/type/column expansions — no new components.

**Tech Stack:** Next.js (async server components, Suspense streaming), React (`"use client"`), Tailwind CSS, Supabase (`getSupabaseServer`), `lib/fmt-date.ts` (`fmtDate`), `components/data/status-pill.tsx` (`StatusPill`)

---

## Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `components/afastamentos/export-history-button.tsx` | Client component — direct CPF-only export |
| Create | `components/afastamentos/afastamento-history-card.tsx` | Async server component + skeleton export |
| Modify | `app/app/afastamentos/[id]/page.tsx` | Add Suspense + AfastamentoHistoryCard between ApprovalBar and main grid |
| Modify | `app/app/afastamentos/page.tsx` | Add `cid` to select, type, and COLUMNS |
| Modify | `app/(portal)/portal/painel/page.tsx` | Add `cid` to select, type, and COLUMNS |

---

## Task 1: ExportHistoryButton client component

**Files:**
- Create: `components/afastamentos/export-history-button.tsx`

- [ ] **Step 1: Create the component**

Create `components/afastamentos/export-history-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";

type Props = { cpf: string };

export function ExportHistoryButton({ cpf }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleClick() {
    setState("loading");
    try {
      const res = await fetch("/api/relatorios/afastamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <span className="text-sm text-[var(--color-fg-muted)]">
        Relatório enviado para o seu e-mail.
      </span>
    );
  }

  if (state === "error") {
    return (
      <span className="text-sm text-red-600">Erro ao gerar relatório.</span>
    );
  }

  return (
    <button
      type="button"
      disabled={state === "loading"}
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-fg-muted)] hover:text-foreground hover:border-[var(--color-fg-muted)] transition-colors disabled:opacity-50"
    >
      <DownloadIcon className="size-4" aria-hidden="true" />
      {state === "loading" ? "Gerando…" : "Exportar histórico"}
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/afastamentos/export-history-button.tsx
git commit -m "feat(afastamentos): add ExportHistoryButton client component"
```

---

## Task 2: AfastamentoHistoryCard async server component

**Files:**
- Create: `components/afastamentos/afastamento-history-card.tsx`

- [ ] **Step 1: Create the component**

Create `components/afastamentos/afastamento-history-card.tsx`:

```tsx
import { getSupabaseServer } from "@/lib/supabase/server";
import { StatusPill } from "@/components/data/status-pill";
import { fmtDate } from "@/lib/fmt-date";
import { ExportHistoryButton } from "./export-history-button";

type HistoryRow = {
  id: string;
  data_inicio: string;
  data_fim: string | null;
  duracao: number | null;
  cid: string | null;
  situacao: string;
};

type Props = { cpf: string; currentId: string };

export async function AfastamentoHistoryCard({ cpf, currentId }: Props) {
  const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  const supabase = await getSupabaseServer();

  const { data } = await supabase
    .from("afastamentos")
    .select("id, data_inicio, data_fim, duracao, cid, situacao")
    .eq("cpf", cpf)
    .neq("situacao", "rejeitado")
    .gte("data_inicio", cutoff)
    .order("data_inicio", { ascending: false })
    .returns<HistoryRow[]>();

  const rows = data ?? [];
  const total = rows.reduce((sum, r) => sum + (r.duracao ?? 0), 0);

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-white">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Histórico 60 dias
        </h2>
        <ExportHistoryButton cpf={cpf} />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            <th className="px-5 py-2 text-left font-semibold">Início</th>
            <th className="px-5 py-2 text-left font-semibold">Fim</th>
            <th className="px-5 py-2 text-left font-semibold">Duração</th>
            <th className="px-5 py-2 text-left font-semibold">CID</th>
            <th className="px-5 py-2 text-left font-semibold">Situação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className={`border-b border-[var(--color-border)] last:border-0 ${
                r.id === currentId ? "bg-[var(--color-bg-subtle)]" : ""
              }`}
            >
              <td className="px-5 py-2 font-mono">{fmtDate(r.data_inicio)}</td>
              <td className="px-5 py-2 font-mono">{r.data_fim ? fmtDate(r.data_fim) : "—"}</td>
              <td className="px-5 py-2">{r.duracao != null ? `${r.duracao} dias` : "—"}</td>
              <td className="px-5 py-2 font-mono">{r.cid ?? "—"}</td>
              <td className="px-5 py-2">
                <StatusPill domain="afastamento" situacao={r.situacao} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--color-border)] font-semibold">
            <td className="px-5 py-2 text-[var(--color-fg-muted)]">Total</td>
            <td className="px-5 py-2 text-[var(--color-fg-muted)]">—</td>
            <td className="px-5 py-2">{total} dias</td>
            <td className="px-5 py-2 text-[var(--color-fg-muted)]">—</td>
            <td className="px-5 py-2 text-[var(--color-fg-muted)]">—</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function AfastamentoHistoryCardSkeleton() {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-white">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
        <div className="h-3 w-28 animate-pulse rounded bg-[var(--color-border)]" />
        <div className="h-8 w-36 animate-pulse rounded-md bg-[var(--color-border)]" />
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-6 px-5 py-3">
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="h-4 w-20 animate-pulse rounded bg-[var(--color-border)]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/afastamentos/afastamento-history-card.tsx
git commit -m "feat(afastamentos): add AfastamentoHistoryCard async server component"
```

---

## Task 3: Wire history card into afastamento detail page

**Files:**
- Modify: `app/app/afastamentos/[id]/page.tsx`

The current page (lines 1–8) imports from Next.js, Supabase, gates, and components. The return JSX at line 74 conditionally renders `<ApprovalBar>`, then at line 76 opens the two-column grid.

- [ ] **Step 1: Add imports**

In `app/app/afastamentos/[id]/page.tsx`, add these two imports after the existing imports (after line 8):

```ts
import { Suspense } from "react";
import {
  AfastamentoHistoryCard,
  AfastamentoHistoryCardSkeleton,
} from "@/components/afastamentos/afastamento-history-card";
```

- [ ] **Step 2: Insert card between ApprovalBar and main grid**

In the JSX, replace the block from `{showApprovalBar && ...}` through the opening of the grid div:

Current (lines 74–76):
```tsx
      {showApprovalBar && <ApprovalBar afastamentoId={row.id} />}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
```

Replace with:
```tsx
      {showApprovalBar && <ApprovalBar afastamentoId={row.id} />}

      <Suspense fallback={<AfastamentoHistoryCardSkeleton />}>
        <AfastamentoHistoryCard cpf={row.cpf} currentId={id} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Run full unit test suite**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add "app/app/afastamentos/[id]/page.tsx"
git commit -m "feat(afastamentos): add AfastamentoHistoryCard to detail page"
```

---

## Task 4: Add CID column to app afastamentos list

**Files:**
- Modify: `app/app/afastamentos/page.tsx`

- [ ] **Step 1: Add `cid` to the type and select string**

In `app/app/afastamentos/page.tsx`, replace the `AfastamentoRow` interface (lines 12–20):

Current:
```ts
interface AfastamentoRow {
  id: string;
  cpf: string;
  colaborador_nome: string;
  data_inicio: string;
  data_fim: string | null;
  situacao: string;
  afastamento_tipos: { rotulo: string } | null;
}
```

Replace with:
```ts
interface AfastamentoRow {
  id: string;
  cpf: string;
  colaborador_nome: string;
  data_inicio: string;
  data_fim: string | null;
  situacao: string;
  cid: string | null;
  afastamento_tipos: { rotulo: string } | null;
}
```

Replace the select string (line 34):

Current:
```ts
      "id, cpf, colaborador_nome, data_inicio, data_fim, situacao, afastamento_tipos!inner(rotulo)",
```

Replace with:
```ts
      "id, cpf, colaborador_nome, data_inicio, data_fim, situacao, cid, afastamento_tipos!inner(rotulo)",
```

- [ ] **Step 2: Add CID column to COLUMNS**

In the `columns` array, add a CID column after the `periodo` column and before `situacao`. The current columns array ends at line 81. Insert after the `periodo` entry:

```ts
    {
      key: "cid",
      label: "CID",
      render: (r) => r.cid ?? "—",
      mono: true,
    },
```

The updated columns array becomes:
```ts
  const columns: DataTableColumn<AfastamentoRow>[] = [
    {
      key: "colaborador",
      label: "Colaborador",
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium">{r.colaborador_nome}</span>
          <span className="font-mono text-xs text-[var(--color-fg-muted)]">
            {r.cpf}
          </span>
        </div>
      ),
    },
    {
      key: "tipo",
      label: "Tipo",
      render: (r) => r.afastamento_tipos?.rotulo ?? "—",
    },
    {
      key: "periodo",
      label: "Período",
      mono: true,
      render: (r) => `${fmtDate(r.data_inicio)} → ${r.data_fim ? fmtDate(r.data_fim) : "—"}`,
    },
    {
      key: "cid",
      label: "CID",
      render: (r) => r.cid ?? "—",
      mono: true,
    },
    {
      key: "situacao",
      label: "Situação",
      render: (r) => <StatusPill domain="afastamento" situacao={r.situacao} />,
    },
  ];
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add "app/app/afastamentos/page.tsx"
git commit -m "feat(afastamentos): add CID column to app list"
```

---

## Task 5: Add CID column to portal painel list

**Files:**
- Modify: `app/(portal)/portal/painel/page.tsx`

- [ ] **Step 1: Add `cid` to the type and select string**

In `app/(portal)/portal/painel/page.tsx`, replace the `AfastamentoRow` type (lines 16–29):

Current:
```ts
type AfastamentoRow = {
  id: string;
  situacao: string;
  data_inicio: string;
  data_fim: string | null;
  duracao: number | null;
  colaborador_nome: string | null;
  colaborador_cargo: string | null;
  colaborador_setor: string | null;
  empresa_id: string;
  afastamento_tipos: { rotulo: string };
  empresas: { nome: string; codigo_soc: string | null };
  unidades: { nome: string } | null;
};
```

Replace with:
```ts
type AfastamentoRow = {
  id: string;
  situacao: string;
  data_inicio: string;
  data_fim: string | null;
  duracao: number | null;
  colaborador_nome: string | null;
  colaborador_cargo: string | null;
  colaborador_setor: string | null;
  empresa_id: string;
  cid: string | null;
  afastamento_tipos: { rotulo: string };
  empresas: { nome: string; codigo_soc: string | null };
  unidades: { nome: string } | null;
};
```

Replace the select string (line 58):

Current:
```ts
        "id, situacao, data_inicio, data_fim, duracao, colaborador_nome, colaborador_cargo, colaborador_setor, empresa_id, afastamento_tipos!inner(rotulo), empresas!inner(nome, codigo_soc), unidades(nome)",
```

Replace with:
```ts
        "id, situacao, data_inicio, data_fim, duracao, colaborador_nome, colaborador_cargo, colaborador_setor, empresa_id, cid, afastamento_tipos!inner(rotulo), empresas!inner(nome, codigo_soc), unidades(nome)",
```

- [ ] **Step 2: Add CID column to COLUMNS**

In the `COLUMNS` constant (lines 31–41), add a CID column after `duracao` and before `situacao`:

Current `COLUMNS`:
```ts
const COLUMNS: DataTableColumn<AfastamentoRow>[] = [
  { key: "tipo",     label: "Tipo",     render: (r) => r.afastamento_tipos.rotulo },
  { key: "inicio",   label: "Início",   render: (r) => fmtDateTime(r.data_inicio, "00:00"), mono: true },
  { key: "fim",      label: "Fim",      render: (r) => r.data_fim ? fmtDateTime(r.data_fim, "23:59") : "—", mono: true },
  { key: "duracao",  label: "Duração",  render: (r) => (r.duracao ? `${r.duracao} dias` : "—") },
  {
    key: "situacao",
    label: "Situação",
    render: (r) => <StatusPill domain="afastamento" situacao={r.situacao} />,
  },
];
```

Replace with:
```ts
const COLUMNS: DataTableColumn<AfastamentoRow>[] = [
  { key: "tipo",     label: "Tipo",     render: (r) => r.afastamento_tipos.rotulo },
  { key: "inicio",   label: "Início",   render: (r) => fmtDateTime(r.data_inicio, "00:00"), mono: true },
  { key: "fim",      label: "Fim",      render: (r) => r.data_fim ? fmtDateTime(r.data_fim, "23:59") : "—", mono: true },
  { key: "duracao",  label: "Duração",  render: (r) => (r.duracao ? `${r.duracao} dias` : "—") },
  { key: "cid",      label: "CID",      render: (r) => r.cid ?? "—", mono: true },
  {
    key: "situacao",
    label: "Situação",
    render: (r) => <StatusPill domain="afastamento" situacao={r.situacao} />,
  },
];
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Run full unit test suite**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add "app/(portal)/portal/painel/page.tsx"
git commit -m "feat(portal): add CID column to portal afastamentos list"
```

---

## Self-Review

**Spec coverage:**
- ✅ `AfastamentoHistoryCard` on detail page below ApprovalBar
- ✅ 60-day window via `data_inicio >= cutoff`, `situacao != 'rejeitado'`
- ✅ Includes pendente records
- ✅ Current afastamento included and highlighted (`bg-[var(--color-bg-subtle)]`)
- ✅ Columns: Início, Fim, Duração, CID, Situação — no `id` column
- ✅ `ORDER BY data_inicio DESC` (most recent first)
- ✅ Sum of duracao in tfoot (null-safe)
- ✅ `ExportHistoryButton` with CPF-only POST, no dialog, inline feedback
- ✅ Skeleton via `AfastamentoHistoryCardSkeleton` + Suspense
- ✅ CID column in app list (`app/app/afastamentos/page.tsx`)
- ✅ CID column in portal list (`app/(portal)/portal/painel/page.tsx`)

**Placeholder scan:** None found.

**Type consistency:** `HistoryRow` defined in Task 2, used only within `afastamento-history-card.tsx`. `Props` in Task 1 (`{ cpf }`) matches what Task 3 passes (`cpf={row.cpf}`). `AfastamentoHistoryCard` props (`cpf`, `currentId`) match Task 3 usage (`cpf={row.cpf} currentId={id}`). ✅
