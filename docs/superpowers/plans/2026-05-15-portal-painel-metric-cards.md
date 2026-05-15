# Portal Painel Metric Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three metric cards (total afastamentos, last afastamento dates, current absence status) above the DataTable on `/portal/painel`.

**Architecture:** All data comes from the existing query in the page — no new DB calls needed. KpiCard gains a `warning` tone using the existing `--color-warning` CSS variable. The page computes three metrics server-side from the already-fetched rows array and renders a responsive card grid between the header and table.

**Tech Stack:** Next.js 15 (server component), TypeScript, Tailwind CSS, existing `KpiCard` component, Vitest for unit tests.

---

### Task 1: Extend KpiCard with warning tone

**Files:**
- Modify: `components/painel/kpi-card.tsx`

Currently `KpiCard` imports `QuickActionTone` (`"primary" | "accent"`) from `quick-action.tsx`. We need a `"warning"` tone without polluting `QuickAction`'s type. Solution: define a local `KpiCardTone` type in `kpi-card.tsx` and drop the cross-component import.

- [ ] **Step 1: Replace the file content**

Replace `components/painel/kpi-card.tsx` with:

```tsx
import { cn } from "@/lib/utils";

export type KpiCardTone = "primary" | "accent" | "warning";

interface KpiCardProps {
  label: string;
  value: number | string;
  delta?: string;
  tone?: KpiCardTone;
}

const toneStrip: Record<KpiCardTone, string> = {
  primary: "bg-[var(--brand-primary-600)]",
  accent:  "bg-[var(--brand-accent-500)]",
  warning: "bg-[var(--color-warning)]",
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

- [ ] **Step 2: Verify the internal painel still type-checks**

`(app)/painel/page.tsx` uses `KpiCard` with `tone="primary"` and `tone="accent"` — both still valid. Check for the import:

```bash
grep -r "QuickActionTone" /Users/heizen/DEV/maia-app/components/painel/kpi-card.tsx
```

Expected: no output (import removed).

- [ ] **Step 3: Commit**

```bash
git add components/painel/kpi-card.tsx
git commit -m "feat(kpi-card): add warning tone; use local KpiCardTone type"
```

---

### Task 2: Add metric computation and card grid to portal painel page

**Files:**
- Modify: `app/(portal)/portal/painel/page.tsx`

**What we compute from existing `rows`:**
- `total` — `rows.length`
- `last` — `rows[0]` (already ordered `criado_em desc`)
- `activeAfastamento` — first row where `situacao === 'aprovado'` and `new Date(data_fim) > now`

**Date helpers needed (local, not exported):**
- `fmtDateOnly(iso)` — strips time, returns `MM/DD/YYYY` (matches existing `fmtDate` format)
- `nextDayFmt(iso)` — adds 1 calendar day, returns `MM/DD/YYYY` (for return date)

- [ ] **Step 1: Add imports and date helpers to the page**

At the top of `app/(portal)/portal/painel/page.tsx`, add `KpiCard` to the imports and add two date helpers after the existing `fmtDate` function:

```tsx
// add to existing imports line
import { KpiCard } from "@/components/painel/kpi-card";
```

After the existing `fmtDate` function, add:

```ts
function fmtDateOnly(iso: string): string {
  const datePart = iso.includes("T") ? iso.split("T")[0] : iso;
  const [y, m, d] = datePart.split("-");
  return `${m}/${d}/${y}`;
}

function nextDayFmt(iso: string): string {
  const datePart = iso.includes("T") ? iso.split("T")[0] : iso;
  const [y, m, d] = datePart.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d) + 1);
  const ry = date.getFullYear();
  const rm = String(date.getMonth() + 1).padStart(2, "0");
  const rd = String(date.getDate()).padStart(2, "0");
  return `${rm}/${rd}/${ry}`;
}
```

- [ ] **Step 2: Compute metrics in the page function body**

Inside `PortalPainelPage`, after the existing `const nome = ...` line, add:

```ts
const total = rows?.length ?? 0;
const last = rows?.[0];
const now = new Date();
const activeAfastamento = rows?.find(
  (r) => r.situacao === "aprovado" && r.data_fim != null && new Date(r.data_fim) > now,
);
const isAfastado = activeAfastamento != null;
```

- [ ] **Step 3: Render the card grid in JSX**

In the `return` block, between `</header>` and `<DataTable`, insert:

```tsx
{total > 0 && (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <KpiCard
      label="Total de afastamentos"
      value={total}
    />
    <KpiCard
      label="Último afastamento"
      value={`${fmtDateOnly(last!.data_inicio)} → ${fmtDateOnly(last!.data_fim!)}`}
    />
    <KpiCard
      label="Status atual"
      value={isAfastado ? "Afastado" : "Sem afastamento ativo"}
      delta={isAfastado ? `Retorno em ${nextDayFmt(activeAfastamento!.data_fim!)}` : undefined}
      tone={isAfastado ? "warning" : "primary"}
    />
  </div>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "portal/painel\|kpi-card"
```

Expected: no errors on those files.

- [ ] **Step 5: Commit**

```bash
git add app/\(portal\)/portal/painel/page.tsx
git commit -m "feat(portal/painel): add metric cards — total, last afastamento, status"
```

---

## Self-Review

**Spec coverage:**
- ✅ Count of all afastamentos → Card 1, `total = rows.length`
- ✅ Last afastamento start → end date → Card 2, `last.data_inicio → last.data_fim`
- ✅ Current status (no active / afastado) → Card 3
- ✅ Only `situacao === 'aprovado'` counts for status → `r.situacao === "aprovado"` filter
- ✅ `data_fim > now` condition → `new Date(r.data_fim) > now`
- ✅ Return date = data_fim + 1 day → `nextDayFmt`
- ✅ Warning/amber tone when afastado → `tone="warning"` + `--color-warning` CSS var
- ✅ Cards hidden when no rows → `{total > 0 && ...}`

**Placeholder scan:** None found.

**Type consistency:** `KpiCardTone` defined in Task 1, used in Task 2. `fmtDateOnly` / `nextDayFmt` defined and used in Task 2 only.
