# Frontend Redesign — Phase 5: Operational Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every remaining operational page (list, detail, admin, public forms) to the same design quality bar as the Phase 1–4 surfaces, sharing a coherent set of primitives (`<DataTable>`, `<FilterRail>`, `<StatusPill>`, `<DetailHeader>`, `<FieldGrid>`, `<TimelineEvents>`, `<ApprovalBar>`, `<AttachmentChip>`, `<Stepper>`, `<EmptyState>`).

**Architecture:** Build shared primitives first (Section A), then compose them in list pages (B), detail pages (C), admin (D), and public forms (E). Pages stay server-rendered where possible; only filter/queue/approval interaction surfaces opt into client components. Existing Supabase queries and API routes are unchanged — restyle is presentational with light data-shape adjustments.

**Tech Stack:** Next.js 16 App Router (route groups `(app)`, `(admin)`, `(public)`), React 19 server components by default, Tailwind v4 with `@theme inline` tokens, shadcn `base-nova` (`@base-ui/react`) primitives, `react-hook-form` + `zod`, `date-fns` (`pt-BR` locale), `lucide-react`, Vitest unit tests, Playwright E2E.

**Radius rule (per user directive):** Every new component caps at `rounded-md` (8px). Never `rounded-full` on rectangles (only on genuinely square boxes like avatars/status dots). The existing `rounded-[var(--radius-xl)]` cards in painel/auth are grandfathered — do not introduce new rounded-xl in this phase.

**Status pill mapping (from spec §8):**

| Domain value | Variant | Class hint |
|---|---|---|
| Afastamento `pendente` | `pending` | accent-soft bg / accent fg |
| Afastamento `aprovado` / `em_andamento` (deprecated)  | `approved` | success-soft / success |
| Afastamento `rejeitado` | `rejected` | danger-soft / danger |
| Afastamento `rascunho` (future) | `draft` | muted bg / muted fg |
| Afastamento `finalizado` | `success` | success-soft / success |
| Afastamento `cancelado` | `draft` | muted bg / muted fg |
| Ocorrência `aberta` | `new` | info-soft / info |
| Ocorrência `em_investigacao` | `investigating` | info-soft / info |
| Ocorrência `concluida` | `success` | success-soft / success |

(Real afastamento situações per `lib/afastamento-state.ts`: `pendente | rejeitado | finalizado | cancelado`. The legacy spec table mentioned `aprovado/em_andamento/rascunho` — those don't exist in the DB. The plan uses only the four real states plus the three ocorrência states.)

---

## File Structure

```
components/
├── data/
│   ├── status-pill.tsx          NEW
│   ├── empty-state.tsx          NEW
│   ├── data-table.tsx           NEW — generic table primitive
│   └── filter-rail.tsx          NEW — URL-state-driven filter row
├── detail/
│   ├── detail-header.tsx        NEW
│   ├── field-grid.tsx           NEW
│   ├── attachment-chip.tsx      NEW
│   ├── stepper.tsx              NEW
│   ├── approval-bar.tsx         NEW
│   └── timeline-events.tsx      NEW — replaces components/eventos-timeline.tsx
├── afastamentos/                REWRITE three files
├── ocorrencias/                 NEW folder (investigation-starter, ocorrencia-detail-card)
├── admin/
│   └── crud-table.tsx           REWRITE — uses DataTable + Sheet, preserves API
├── forms/
│   ├── public-form-shell.tsx    NEW — header banner + back link + content slot
│   ├── afastamento-form.tsx     REWRITE
│   └── ocorrencia-form.tsx      REWRITE — multi-step
└── eventos-timeline.tsx         DELETE (replaced by detail/timeline-events.tsx)

lib/
├── filter-rail.ts               NEW — parse/build URL search params for FilterRail
├── status-pill.ts               NEW — variant resolver for situacao strings
└── ocorrencia-state.ts          NEW — situacao type + label mapping

tests/unit/
├── status-pill.test.ts          NEW
├── filter-rail.test.ts          NEW
├── ocorrencia-state.test.ts     NEW
└── eventos-format.test.ts       (existing — extend if needed)

tests/e2e/
└── happy-path.spec.ts           UPDATE selectors as needed
```

---

# Section A — Shared primitives

### Task 1: `<StatusPill>` + `<EmptyState>`

Foundation pieces used by every list and detail page. StatusPill maps a domain situação string to a tone-coded pill; EmptyState is a centered "no records" affordance for list/queue/timeline empty cases.

**Files:**
- Create: `lib/status-pill.ts`
- Create: `components/data/status-pill.tsx`
- Create: `components/data/empty-state.tsx`
- Test: `tests/unit/status-pill.test.ts`

- [ ] **Step 1: Write the failing test for `lib/status-pill.ts`**

Create `tests/unit/status-pill.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveStatusPill } from "@/lib/status-pill";

describe("resolveStatusPill", () => {
  it("maps afastamento situações", () => {
    expect(resolveStatusPill("afastamento", "pendente")).toEqual({ tone: "pending", label: "Pendente" });
    expect(resolveStatusPill("afastamento", "rejeitado")).toEqual({ tone: "rejected", label: "Rejeitado" });
    expect(resolveStatusPill("afastamento", "finalizado")).toEqual({ tone: "success", label: "Finalizado" });
    expect(resolveStatusPill("afastamento", "cancelado")).toEqual({ tone: "draft", label: "Cancelado" });
  });

  it("maps ocorrência situações", () => {
    expect(resolveStatusPill("ocorrencia", "aberta")).toEqual({ tone: "new", label: "Aberta" });
    expect(resolveStatusPill("ocorrencia", "em_investigacao")).toEqual({ tone: "investigating", label: "Em investigação" });
    expect(resolveStatusPill("ocorrencia", "concluida")).toEqual({ tone: "success", label: "Concluída" });
  });

  it("falls back to draft tone with raw label for unknown situações", () => {
    expect(resolveStatusPill("afastamento", "fubar" as never)).toEqual({ tone: "draft", label: "fubar" });
  });
});
```

- [ ] **Step 2: Run test (expect FAIL — module missing)**

Run: `npx vitest run tests/unit/status-pill.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement `lib/status-pill.ts`**

```ts
export type StatusTone =
  | "pending"
  | "approved"
  | "rejected"
  | "draft"
  | "success"
  | "new"
  | "investigating";

export type StatusDomain = "afastamento" | "ocorrencia";

export interface StatusPillSpec {
  tone: StatusTone;
  label: string;
}

const AFASTAMENTO: Record<string, StatusPillSpec> = {
  pendente:   { tone: "pending",  label: "Pendente" },
  rejeitado:  { tone: "rejected", label: "Rejeitado" },
  finalizado: { tone: "success",  label: "Finalizado" },
  cancelado:  { tone: "draft",    label: "Cancelado" },
};

const OCORRENCIA: Record<string, StatusPillSpec> = {
  aberta:           { tone: "new",           label: "Aberta" },
  em_investigacao:  { tone: "investigating", label: "Em investigação" },
  concluida:        { tone: "success",       label: "Concluída" },
};

export function resolveStatusPill(domain: StatusDomain, situacao: string): StatusPillSpec {
  const map = domain === "afastamento" ? AFASTAMENTO : OCORRENCIA;
  return map[situacao] ?? { tone: "draft", label: situacao };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/status-pill.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Create `components/data/status-pill.tsx`**

```tsx
import { cn } from "@/lib/utils";
import { resolveStatusPill, type StatusDomain, type StatusTone } from "@/lib/status-pill";

const TONE_CLASS: Record<StatusTone, string> = {
  pending:       "bg-[var(--color-accent-soft)] text-[var(--brand-accent-600)]",
  approved:      "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  rejected:      "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  draft:         "bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]",
  success:       "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  new:           "bg-[var(--color-info-soft)] text-[var(--color-info)]",
  investigating: "bg-[var(--color-info-soft)] text-[var(--color-info)]",
};

interface StatusPillProps {
  domain: StatusDomain;
  situacao: string;
  className?: string;
}

export function StatusPill({ domain, situacao, className }: StatusPillProps) {
  const spec = resolveStatusPill(domain, situacao);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        TONE_CLASS[spec.tone],
        className,
      )}
    >
      {spec.label}
    </span>
  );
}
```

- [ ] **Step 6: Create `components/data/empty-state.tsx`**

```tsx
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, hint, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-6 py-12 text-center">
      {Icon && (
        <span className="grid size-10 place-items-center rounded-md bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-sm text-xs text-[var(--color-fg-muted)]">{hint}</p>}
      {action}
    </div>
  );
}
```

- [ ] **Step 7: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add lib/status-pill.ts components/data/status-pill.tsx components/data/empty-state.tsx tests/unit/status-pill.test.ts
git commit -m "feat(phase-5): add StatusPill + EmptyState primitives"
```

---

### Task 2: `<DataTable>` generic primitive

Server-renderable generic table built on shadcn `Table`. Columns config maps row → cells; supports per-row link wrapper, mono cells for dates/CPF, and optional empty-state slot.

**Files:**
- Create: `components/data/data-table.tsx`

- [ ] **Step 1: Create `components/data/data-table.tsx`**

```tsx
import Link from "next/link";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableColumn<Row> {
  /** Stable column key (used for React key). */
  key: string;
  /** Header label. */
  label: string;
  /** Render the cell value for a given row. */
  render: (row: Row) => React.ReactNode;
  /** Render the cell in a monospaced font (good for dates / CPF / IDs). */
  mono?: boolean;
  /** Tailwind width helper, e.g. "w-32". */
  width?: string;
  /** Right-align the cell (good for numeric/timestamp columns). */
  align?: "left" | "right";
}

interface DataTableProps<Row> {
  rows: Row[];
  columns: DataTableColumn<Row>[];
  /** Stable row id for React keys. */
  getRowId: (row: Row) => string;
  /** Wrap each row in a link to this href. Mutually exclusive with onRowClick (link wins). */
  getRowHref?: (row: Row) => string;
  /** Empty-state node when rows.length === 0. */
  empty: React.ReactNode;
}

export function DataTable<Row>({
  rows, columns, getRowId, getRowHref, empty,
}: DataTableProps<Row>) {
  if (rows.length === 0) {
    return <>{empty}</>;
  }
  return (
    <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-[var(--color-bg-subtle)]">
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]",
                  c.width,
                  c.align === "right" && "text-right",
                )}
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const id = getRowId(row);
            const href = getRowHref?.(row);
            return (
              <TableRow key={id} className="hover:bg-[var(--color-bg-subtle)]">
                {columns.map((c) => {
                  const cell = (
                    <span className={cn(c.mono && "font-mono text-[13px]")}>{c.render(row)}</span>
                  );
                  return (
                    <TableCell
                      key={c.key}
                      className={cn(
                        "text-sm",
                        c.align === "right" && "text-right",
                        href && "p-0",
                      )}
                    >
                      {href ? (
                        <Link href={href} className="block px-3 py-2.5">
                          {cell}
                        </Link>
                      ) : (
                        cell
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/data/data-table.tsx
git commit -m "feat(phase-5): add DataTable generic primitive"
```

---

### Task 3: `<FilterRail>` (URL-state-driven)

Search input + status chips that mutate the URL search params. Pages read `searchParams` server-side for the actual filtering; FilterRail is client-only for the input/chip interactions. URL is the source of truth.

**Files:**
- Create: `lib/filter-rail.ts`
- Create: `components/data/filter-rail.tsx`
- Test: `tests/unit/filter-rail.test.ts`

- [ ] **Step 1: Write the failing test for `lib/filter-rail.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildFilterHref, parseFilterParams } from "@/lib/filter-rail";

describe("parseFilterParams", () => {
  it("extracts q and status as strings", () => {
    expect(parseFilterParams({ q: "joao", status: "pendente" })).toEqual({ q: "joao", status: "pendente" });
  });
  it("returns empty values when absent", () => {
    expect(parseFilterParams({})).toEqual({ q: "", status: "" });
  });
  it("ignores array values (URL repeated keys)", () => {
    expect(parseFilterParams({ q: ["a", "b"], status: undefined })).toEqual({ q: "", status: "" });
  });
});

describe("buildFilterHref", () => {
  it("merges patch into existing params", () => {
    expect(buildFilterHref("/afastamentos", { q: "joao" }, { status: "pendente" }))
      .toBe("/afastamentos?q=joao&status=pendente");
  });
  it("clears a param when patch value is empty string", () => {
    expect(buildFilterHref("/afastamentos", { q: "joao", status: "pendente" }, { status: "" }))
      .toBe("/afastamentos?q=joao");
  });
  it("returns the bare path when all params are empty", () => {
    expect(buildFilterHref("/afastamentos", { status: "pendente" }, { status: "" }))
      .toBe("/afastamentos");
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

Run: `npx vitest run tests/unit/filter-rail.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/filter-rail.ts`**

```ts
export interface FilterParams {
  q: string;
  status: string;
}

export function parseFilterParams(
  sp: Record<string, string | string[] | undefined>,
): FilterParams {
  const pick = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : "";
  return { q: pick(sp.q), status: pick(sp.status) };
}

export function buildFilterHref(
  basePath: string,
  current: Partial<FilterParams>,
  patch: Partial<FilterParams>,
): string {
  const merged: Partial<FilterParams> = { ...current, ...patch };
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) usp.set(k, v);
  }
  const qs = usp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/filter-rail.test.ts`
Expected: 6 passing.

- [ ] **Step 5: Create `components/data/filter-rail.tsx`**

```tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildFilterHref, parseFilterParams } from "@/lib/filter-rail";

export interface FilterChip {
  /** URL value for the status param. Empty string = "all". */
  value: string;
  label: string;
  /** Tone: "urgent" uses accent-soft when active (e.g. Pendentes). */
  tone?: "default" | "urgent";
}

interface FilterRailProps {
  basePath: string;
  /** Status chips shown to the right of the search input. First chip should be "all". */
  chips: FilterChip[];
  /** Placeholder for the search input. */
  searchPlaceholder?: string;
}

export function FilterRail({ basePath, chips, searchPlaceholder = "Buscar…" }: FilterRailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = parseFilterParams(Object.fromEntries(searchParams.entries()));

  const [draftQ, setDraftQ] = React.useState(current.q);
  React.useEffect(() => { setDraftQ(current.q); }, [current.q]);

  function commit(patch: { q?: string; status?: string }) {
    router.push(buildFilterHref(basePath, current, patch));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    commit({ q: draftQ });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <form onSubmit={onSubmit} className="relative w-full max-w-sm">
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-fg-muted)]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={draftQ}
          onChange={(e) => setDraftQ(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-md border border-[var(--color-border)] bg-white py-1.5 pl-9 pr-3 text-sm placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--brand-primary-600)] focus:outline-none"
        />
      </form>
      <div role="tablist" aria-label="Filtro de situação" className="flex flex-wrap items-center gap-1.5">
        {chips.map((chip) => {
          const active = current.status === chip.value;
          const isUrgent = chip.tone === "urgent";
          return (
            <button
              key={chip.value || "__all"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => commit({ status: chip.value })}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? isUrgent
                    ? "bg-[var(--color-accent-soft)] text-[var(--brand-accent-600)]"
                    : "bg-[var(--brand-primary-50)] text-[var(--brand-primary-600)]"
                  : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-foreground",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add lib/filter-rail.ts components/data/filter-rail.tsx tests/unit/filter-rail.test.ts
git commit -m "feat(phase-5): add FilterRail with URL-state filters"
```

---

### Task 4: `<DetailHeader>` + `<FieldGrid>`

Reusable detail-page header (breadcrumb + h1 + meta row + actions slot) and labeled-field grid for record bodies.

**Files:**
- Create: `components/detail/detail-header.tsx`
- Create: `components/detail/field-grid.tsx`

- [ ] **Step 1: Create `components/detail/detail-header.tsx`**

```tsx
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface DetailHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  /** Optional mono suffix appended to title (e.g. record ID, CPF). */
  titleSuffix?: string;
  /** Meta row beneath the title — status pill, dates, urgency callout. */
  meta?: React.ReactNode;
  /** Right-aligned action slot. */
  actions?: React.ReactNode;
}

export function DetailHeader({ breadcrumbs, title, titleSuffix, meta, actions }: DetailHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-3 border-b border-[var(--color-border)] pb-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-[var(--color-fg-muted)]">
        {breadcrumbs.map((b, i) => {
          const last = i === breadcrumbs.length - 1;
          return (
            <span key={`${b.label}-${i}`} className="inline-flex items-center gap-1">
              {b.href && !last ? (
                <Link href={b.href} className="hover:text-foreground">{b.label}</Link>
              ) : (
                <span className={cn(last && "text-foreground")}>{b.label}</span>
              )}
              {!last && <ChevronRightIcon className="size-3 text-[var(--color-fg-subtle)]" aria-hidden="true" />}
            </span>
          );
        })}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
          {titleSuffix && (
            <span className="ml-2 font-mono text-base font-normal text-[var(--color-fg-muted)]">
              {titleSuffix}
            </span>
          )}
        </h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {meta && <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-fg-muted)]">{meta}</div>}
    </header>
  );
}
```

- [ ] **Step 2: Create `components/detail/field-grid.tsx`**

```tsx
import { cn } from "@/lib/utils";

export interface Field {
  label: string;
  value: React.ReactNode;
  /** Use the mono font for IDs / CPF / dates. */
  mono?: boolean;
  /** Span the full row width (2 cols). */
  full?: boolean;
}

interface FieldGridProps {
  fields: Field[];
  className?: string;
}

export function FieldGrid({ fields, className }: FieldGridProps) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {fields.map((f, i) => (
        <div key={`${f.label}-${i}`} className={cn("flex flex-col gap-1", f.full && "sm:col-span-2")}>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
            {f.label}
          </dt>
          <dd className={cn("text-sm text-foreground", f.mono && "font-mono text-[13px]")}>
            {f.value ?? <span className="text-[var(--color-fg-subtle)]">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
```

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/detail/detail-header.tsx components/detail/field-grid.tsx
git commit -m "feat(phase-5): add DetailHeader + FieldGrid primitives"
```

---

### Task 5: `<AttachmentChip>` + `<Stepper>`

Small detail-page leaf (file link with type icon + filename) and a horizontal stepper for multi-step flows (`ocorrencias/investigacao` + multi-step public ocorrência form).

**Files:**
- Create: `components/detail/attachment-chip.tsx`
- Create: `components/detail/stepper.tsx`

- [ ] **Step 1: Create `components/detail/attachment-chip.tsx`**

```tsx
import { FileIcon, FileImageIcon, FileTextIcon } from "lucide-react";

function pickIcon(filename: string) {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (["pdf", "txt", "md"].includes(ext)) return FileTextIcon;
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return FileImageIcon;
  return FileIcon;
}

interface AttachmentChipProps {
  href: string;
  filename: string;
  /** Optional caption (size, uploaded-by, etc.). */
  caption?: string;
}

export function AttachmentChip({ href, filename, caption }: AttachmentChipProps) {
  const Icon = pickIcon(filename);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-foreground transition-colors hover:border-[var(--brand-primary-600)] hover:bg-[var(--brand-primary-50)]"
    >
      <Icon className="size-4 text-[var(--color-fg-muted)]" aria-hidden="true" />
      <span className="flex flex-col leading-tight">
        <span className="font-medium">{filename}</span>
        {caption && <span className="text-xs text-[var(--color-fg-muted)]">{caption}</span>}
      </span>
    </a>
  );
}
```

- [ ] **Step 2: Create `components/detail/stepper.tsx`**

```tsx
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperStep {
  label: string;
}

interface StepperProps {
  steps: StepperStep[];
  /** Zero-based current step index. */
  current: number;
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex items-center gap-2" aria-label="Etapas">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                done && "bg-[var(--color-success)] text-white",
                active && "bg-[var(--brand-primary-600)] text-white",
                !done && !active && "bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]",
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? <CheckIcon className="size-4" aria-hidden="true" /> : i + 1}
            </span>
            <span
              className={cn(
                "relative flex-1 truncate text-sm",
                active ? "font-semibold text-foreground" : "text-[var(--color-fg-muted)]",
              )}
            >
              {s.label}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1 left-0 h-[2px] w-8 bg-[var(--brand-accent-500)]"
                />
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

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/detail/attachment-chip.tsx components/detail/stepper.tsx
git commit -m "feat(phase-5): add AttachmentChip + Stepper primitives"
```

---

### Task 6: `<ApprovalBar>` (afastamento inline approval)

Accent-tinted strip with inline Aprovar / Rejeitar buttons. Wraps the existing `<AprovarRejeitarActions>` behavior but with the new visual treatment. Rejeitar opens a shadcn `Dialog` with the motivo textarea instead of an always-visible textarea.

**Files:**
- Create: `components/detail/approval-bar.tsx`
- Delete: `components/afastamentos/aprovar-rejeitar-actions.tsx` (replaced by ApprovalBar)

- [ ] **Step 1: Create `components/detail/approval-bar.tsx`**

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ApprovalBarProps {
  /** Afastamento ID — used to build API URLs. */
  afastamentoId: string;
}

export function ApprovalBar({ afastamentoId }: ApprovalBarProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [open, setOpen] = React.useState(false);

  async function aprovar() {
    setBusy(true);
    const r = await fetch(`/api/afastamentos/${afastamentoId}/aprovar`, { method: "POST" });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.error ?? "Erro ao aprovar.");
      return;
    }
    toast.success("Aprovado.");
    router.refresh();
  }

  async function rejeitar() {
    if (!motivo.trim()) {
      toast.error("Informe o motivo da rejeição.");
      return;
    }
    setBusy(true);
    const r = await fetch(`/api/afastamentos/${afastamentoId}/rejeitar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.error ?? "Erro ao rejeitar.");
      return;
    }
    toast.success("Rejeitado.");
    setOpen(false);
    setMotivo("");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-accent-soft)] px-4 py-3">
      <div className="flex flex-col">
        <p className="text-sm font-semibold text-foreground">Este afastamento aguarda sua aprovação.</p>
        <p className="text-xs text-[var(--color-fg-muted)]">
          Revise os dados do colaborador e o anexo antes de aprovar ou rejeitar.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" disabled={busy}>
                <XIcon className="size-4" aria-hidden="true" />
                Rejeitar
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar afastamento</DialogTitle>
              <DialogDescription>
                O colaborador receberá um link para corrigir e reenviar.
              </DialogDescription>
            </DialogHeader>
            <Label htmlFor="motivo">Motivo da rejeição</Label>
            <Textarea
              id="motivo"
              rows={4}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: CID ilegível, datas inconsistentes…"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button onClick={rejeitar} disabled={busy} className="bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90">
                Confirmar rejeição
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button
          onClick={aprovar}
          disabled={busy}
          className="bg-[var(--color-success)] text-white hover:bg-[var(--color-success)]/90"
        >
          <CheckIcon className="size-4" aria-hidden="true" />
          Aprovar
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. (If `<Dialog>` API doesn't match the existing shadcn install, read `components/ui/dialog.tsx` and align — the project uses `@base-ui/react`, so `<DialogTrigger render={...}>` is the correct pattern.)

- [ ] **Step 3: Commit**

```bash
git add components/detail/approval-bar.tsx
git commit -m "feat(phase-5): add ApprovalBar inline approval component"
```

(Deletion of `aprovar-rejeitar-actions.tsx` is deferred to Task 12 when the consumer is replaced.)

---

### Task 7: `<TimelineEvents>` rewrite

Replace `components/eventos-timeline.tsx` with a server-renderable version that takes pre-fetched rows (page owns the supabase query), formats them with the existing `eventos-format.ts` helpers, and renders a vertical timeline with tone-coded dots.

**Files:**
- Create: `components/detail/timeline-events.tsx`
- Delete: `components/eventos-timeline.tsx` (after consumers migrate — done in Tasks 12/13)

- [ ] **Step 1: Create `components/detail/timeline-events.tsx`**

```tsx
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  eventoDotTone,
  formatEventoVerb,
  type EventoTone,
  type TipoEntidade,
} from "@/lib/eventos-format";
import type { EventoType } from "@/lib/eventos";
import { EmptyState } from "@/components/data/empty-state";
import { ClockIcon } from "lucide-react";

export interface TimelineEventRow {
  id: string;
  evento: EventoType;
  ocorrido_em: string;
  /** Joined: usuarios:autor_id(nome) */
  usuarios?: { nome: string | null } | null;
}

interface TimelineEventsProps {
  rows: TimelineEventRow[];
  /** Used by the verb formatter to phrase the entry. Not currently shown but kept for parity. */
  tipoEntidade: TipoEntidade;
}

const DOT_CLASS: Record<EventoTone, string> = {
  new:      "bg-[var(--color-info)]",
  approved: "bg-[var(--color-success)]",
  rejected: "bg-[var(--color-danger)]",
  muted:    "bg-[var(--color-fg-subtle)]",
};

export function TimelineEvents({ rows, tipoEntidade }: TimelineEventsProps) {
  if (rows.length === 0) {
    return <EmptyState icon={ClockIcon} title="Sem eventos ainda." />;
  }
  return (
    <ol className="space-y-3" aria-label="Histórico">
      {rows.map((row) => {
        const tone = eventoDotTone(row.evento);
        const verb = formatEventoVerb(row.evento);
        const autor = row.usuarios?.nome?.trim() || "Sistema";
        const when = formatDistanceToNow(new Date(row.ocorrido_em), { addSuffix: true, locale: ptBR });
        return (
          <li key={row.id} className="flex gap-3">
            <span className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={cn("size-2 rounded-full", DOT_CLASS[tone])}
              />
              <span aria-hidden="true" className="mt-1 h-full w-px bg-[var(--color-border)]" />
            </span>
            <div className="flex flex-col pb-3 leading-tight">
              <p className="text-sm text-foreground">
                <span className="font-semibold">{autor}</span> {verb}.
              </p>
              <time
                dateTime={row.ocorrido_em}
                className="text-xs text-[var(--color-fg-muted)]"
                title={new Date(row.ocorrido_em).toLocaleString("pt-BR")}
              >
                {when}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
```

(`tipoEntidade` is unused for now but kept on the props so consumers don't need to drop it when the verb formatter starts referencing it.)

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/detail/timeline-events.tsx
git commit -m "feat(phase-5): rewrite TimelineEvents as server component with tone dots"
```

---

# Section B — List pages

### Task 8: `/afastamentos` list rewrite

Page-head (breadcrumb + h1 + record count + "＋ Novo afastamento" link) → FilterRail → DataTable. Server-side filtering driven by `searchParams.q` (matches colaborador_nome or cpf) and `searchParams.status`.

**Files:**
- Modify: `app/(app)/afastamentos/page.tsx` (full rewrite)
- Delete: `components/tables/afastamentos-table.tsx` (replaced by inline DataTable composition)

- [ ] **Step 1: Rewrite `app/(app)/afastamentos/page.tsx`**

```tsx
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { FilterRail } from "@/components/data/filter-rail";
import { StatusPill } from "@/components/data/status-pill";
import { EmptyState } from "@/components/data/empty-state";
import { ClipboardListIcon } from "lucide-react";
import { parseFilterParams } from "@/lib/filter-rail";

interface AfastamentoRow {
  id: string;
  cpf: string;
  colaborador_nome: string;
  data_inicio: string;
  data_fim: string | null;
  situacao: string;
  afastamento_tipos: { rotulo: string } | null;
}

export default async function AfastamentosListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { q, status } = parseFilterParams(sp);

  const supabase = await getSupabaseServer();
  let query = supabase
    .from("afastamentos")
    .select("id, cpf, colaborador_nome, data_inicio, data_fim, situacao, afastamento_tipos!inner(rotulo)")
    .order("criado_em", { ascending: false })
    .limit(200);
  if (status) query = query.eq("situacao", status);
  if (q) {
    const safe = q.replace(/[%_]/g, "\\$&");
    query = query.or(`colaborador_nome.ilike.%${safe}%,cpf.ilike.%${safe}%`);
  }
  const { data } = await query.returns<AfastamentoRow[]>();
  const rows = data ?? [];

  const columns: DataTableColumn<AfastamentoRow>[] = [
    {
      key: "colaborador",
      label: "Colaborador",
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium">{r.colaborador_nome}</span>
          <span className="font-mono text-xs text-[var(--color-fg-muted)]">{r.cpf}</span>
        </div>
      ),
    },
    { key: "tipo", label: "Tipo", render: (r) => r.afastamento_tipos?.rotulo ?? "—" },
    {
      key: "periodo",
      label: "Período",
      mono: true,
      render: (r) => `${r.data_inicio} → ${r.data_fim ?? "—"}`,
    },
    {
      key: "situacao",
      label: "Situação",
      render: (r) => <StatusPill domain="afastamento" situacao={r.situacao} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div className="flex flex-col">
          <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
            <Link href="/painel" className="hover:text-foreground">Painel</Link>
            <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
            <span className="text-foreground">Afastamentos</span>
          </nav>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Afastamentos</h1>
          <p className="text-sm text-[var(--color-fg-muted)]">{rows.length} registro{rows.length === 1 ? "" : "s"}</p>
        </div>
        <Link
          href="/forms/afastamentos"
          className="relative inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary-600)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand-primary-700)]"
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          Novo afastamento
          <span aria-hidden="true" className="absolute -bottom-px left-2 right-2 h-[2px] bg-[var(--brand-accent-500)]" />
        </Link>
      </header>

      <FilterRail
        basePath="/afastamentos"
        searchPlaceholder="Buscar por nome ou CPF…"
        chips={[
          { value: "",           label: "Todos" },
          { value: "pendente",   label: "Pendentes", tone: "urgent" },
          { value: "finalizado", label: "Finalizados" },
          { value: "rejeitado",  label: "Rejeitados" },
          { value: "cancelado",  label: "Cancelados" },
        ]}
      />

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        getRowHref={(r) => `/afastamentos/${r.id}`}
        empty={<EmptyState icon={ClipboardListIcon} title="Nenhum afastamento encontrado." hint="Ajuste os filtros ou registre um novo afastamento." />}
      />
    </div>
  );
}
```

- [ ] **Step 2: Delete legacy table file**

```bash
git rm components/tables/afastamentos-table.tsx
```

- [ ] **Step 3: Type-check + build + commit**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run build`
Expected: build succeeds; `/afastamentos` route compiles.

```bash
git add app/(app)/afastamentos/page.tsx
git commit -m "feat(phase-5): rewrite /afastamentos list with DataTable + FilterRail"
```

---

### Task 9: `/afastamentos/aprovacoes` focused queue rewrite

Per spec §8, this diverges from the list pattern: card-per-item with inline Aprovar (green) / Rejeitar (red outline) / Ver detalhes. Urgent cards (no urgency-data exists yet) skip the accent border for now; the structural slot is built but the heuristic is deferred (`isUrgent={false}` placeholder).

**Files:**
- Modify: `app/(app)/afastamentos/aprovacoes/page.tsx`
- Modify: `components/afastamentos/aprovacoes-panel.tsx` (full rewrite)

- [ ] **Step 1: Rewrite `components/afastamentos/aprovacoes-panel.tsx`**

```tsx
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRightIcon, FileTextIcon } from "lucide-react";
import { ApprovalBar } from "@/components/detail/approval-bar";
import { EmptyState } from "@/components/data/empty-state";
import { cn } from "@/lib/utils";

export interface PendenteRow {
  id: string;
  colaborador_nome: string;
  cpf: string;
  data_inicio: string;
  data_fim: string | null;
  criado_em: string;
  email_remetente: string;
  arquivo_url: string | null;
  afastamento_tipos: { rotulo: string } | null;
}

interface AprovacoesPanelProps {
  pendentes: PendenteRow[];
}

export function AprovacoesPanel({ pendentes }: AprovacoesPanelProps) {
  if (pendentes.length === 0) {
    return (
      <EmptyState
        icon={FileTextIcon}
        title="Sem pendências."
        hint="Quando colaboradores enviarem afastamentos, eles aparecerão aqui."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {pendentes.map((p) => {
        const isUrgent = false;
        const since = formatDistanceToNow(new Date(p.criado_em), { addSuffix: true, locale: ptBR });
        return (
          <li
            key={p.id}
            className={cn(
              "relative rounded-md border border-[var(--color-border)] bg-white shadow-[var(--shadow-xs)]",
              isUrgent && "border-l-[3px] border-l-[var(--brand-accent-500)]",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] p-4">
              <div className="flex flex-col">
                <p className="text-base font-semibold text-foreground">{p.colaborador_nome}</p>
                <p className="font-mono text-xs text-[var(--color-fg-muted)]">{p.cpf}</p>
                <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                  {p.afastamento_tipos?.rotulo ?? "—"} · {p.data_inicio}
                  {p.data_fim ? ` → ${p.data_fim}` : ""}
                </p>
              </div>
              <div className="text-right text-xs text-[var(--color-fg-muted)]">
                <p>Enviado {since}</p>
                <p>{p.email_remetente}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <Link
                href={`/afastamentos/${p.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-primary-600)] hover:underline"
              >
                Ver detalhes
                <ArrowRightIcon className="size-3.5" aria-hidden="true" />
              </Link>
              <ApprovalBar afastamentoId={p.id} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 2: Rewrite `app/(app)/afastamentos/aprovacoes/page.tsx`**

```tsx
import Link from "next/link";
import { requireEquipe } from "@/components/gates/equipe-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import { AprovacoesPanel, type PendenteRow } from "@/components/afastamentos/aprovacoes-panel";

export default async function AprovacoesPage() {
  await requireEquipe("oh");
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("afastamentos")
    .select("id, colaborador_nome, cpf, data_inicio, data_fim, criado_em, email_remetente, arquivo_url, afastamento_tipos!inner(rotulo)")
    .eq("situacao", "pendente")
    .order("criado_em", { ascending: true })
    .returns<PendenteRow[]>();
  const pendentes = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/painel" className="hover:text-foreground">Painel</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <Link href="/afastamentos" className="hover:text-foreground">Afastamentos</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span className="text-foreground">Aprovações</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Aprovações pendentes</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          {pendentes.length} aguardando revisão
        </p>
      </header>
      <AprovacoesPanel pendentes={pendentes} />
    </div>
  );
}
```

- [ ] **Step 3: Type-check + build + commit**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

```bash
git add app/(app)/afastamentos/aprovacoes/page.tsx components/afastamentos/aprovacoes-panel.tsx
git commit -m "feat(phase-5): rewrite /afastamentos/aprovacoes as focused queue"
```

---

### Task 10: `/ocorrencias` list rewrite

Same pattern as Task 8. Adds an `ocorrencia-state.ts` helper that maps tipo enum values to human labels (used in the table tipo cell).

**Files:**
- Create: `lib/ocorrencia-state.ts`
- Test: `tests/unit/ocorrencia-state.test.ts`
- Modify: `app/(app)/ocorrencias/page.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ocorrencia-state.test.ts
import { describe, expect, it } from "vitest";
import { ocorrenciaTipoLabel, OCORRENCIA_SITUACOES } from "@/lib/ocorrencia-state";

describe("ocorrenciaTipoLabel", () => {
  it("maps each enum value to a Portuguese label", () => {
    expect(ocorrenciaTipoLabel("quase_acidente")).toBe("Quase-acidente");
    expect(ocorrenciaTipoLabel("acidente_leve")).toBe("Acidente leve");
    expect(ocorrenciaTipoLabel("acidente_grave")).toBe("Acidente grave");
    expect(ocorrenciaTipoLabel("doenca_ocupacional")).toBe("Doença ocupacional");
    expect(ocorrenciaTipoLabel("outro")).toBe("Outro");
  });
  it("falls back to the raw value for unknown tipos", () => {
    expect(ocorrenciaTipoLabel("misc")).toBe("misc");
  });
});

describe("OCORRENCIA_SITUACOES", () => {
  it("includes the three real situações in order", () => {
    expect(OCORRENCIA_SITUACOES).toEqual(["aberta", "em_investigacao", "concluida"]);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

Run: `npx vitest run tests/unit/ocorrencia-state.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `lib/ocorrencia-state.ts`**

```ts
export const OCORRENCIA_SITUACOES = ["aberta", "em_investigacao", "concluida"] as const;
export type OcorrenciaSituacao = (typeof OCORRENCIA_SITUACOES)[number];

const TIPO_LABELS: Record<string, string> = {
  quase_acidente:      "Quase-acidente",
  acidente_leve:       "Acidente leve",
  acidente_grave:      "Acidente grave",
  doenca_ocupacional:  "Doença ocupacional",
  outro:               "Outro",
};

export function ocorrenciaTipoLabel(tipo: string): string {
  return TIPO_LABELS[tipo] ?? tipo;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/ocorrencia-state.test.ts`
Expected: 2 passing.

- [ ] **Step 5: Rewrite `app/(app)/ocorrencias/page.tsx`**

```tsx
import Link from "next/link";
import { PlusIcon, AlertTriangleIcon } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { FilterRail } from "@/components/data/filter-rail";
import { StatusPill } from "@/components/data/status-pill";
import { EmptyState } from "@/components/data/empty-state";
import { parseFilterParams } from "@/lib/filter-rail";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";

interface OcorrenciaRow {
  id: string;
  tipo: string;
  situacao: string;
  data_ocorrencia: string;
  empresas: { nome: string } | null;
}

export default async function OcorrenciasListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { q, status } = parseFilterParams(sp);

  const supabase = await getSupabaseServer();
  let query = supabase
    .from("ocorrencias")
    .select("id, tipo, situacao, data_ocorrencia, empresas!inner(nome)")
    .order("criado_em", { ascending: false })
    .limit(200);
  if (status) query = query.eq("situacao", status);
  if (q) {
    const safe = q.replace(/[%_]/g, "\\$&");
    query = query.or(`tipo.ilike.%${safe}%,descricao.ilike.%${safe}%`);
  }
  const { data } = await query.returns<OcorrenciaRow[]>();
  const rows = data ?? [];

  const columns: DataTableColumn<OcorrenciaRow>[] = [
    { key: "tipo", label: "Tipo", render: (r) => ocorrenciaTipoLabel(r.tipo) },
    { key: "empresa", label: "Empresa", render: (r) => r.empresas?.nome ?? "—" },
    {
      key: "data",
      label: "Data",
      mono: true,
      render: (r) => new Date(r.data_ocorrencia).toLocaleDateString("pt-BR"),
    },
    {
      key: "situacao",
      label: "Situação",
      render: (r) => <StatusPill domain="ocorrencia" situacao={r.situacao} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div className="flex flex-col">
          <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
            <Link href="/painel" className="hover:text-foreground">Painel</Link>
            <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
            <span className="text-foreground">Ocorrências</span>
          </nav>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Ocorrências</h1>
          <p className="text-sm text-[var(--color-fg-muted)]">{rows.length} registro{rows.length === 1 ? "" : "s"}</p>
        </div>
        <Link
          href="/forms/ocorrencias"
          className="relative inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary-600)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand-primary-700)]"
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          Nova ocorrência
          <span aria-hidden="true" className="absolute -bottom-px left-2 right-2 h-[2px] bg-[var(--brand-accent-500)]" />
        </Link>
      </header>

      <FilterRail
        basePath="/ocorrencias"
        searchPlaceholder="Buscar por tipo ou descrição…"
        chips={[
          { value: "",                label: "Todas" },
          { value: "aberta",          label: "Abertas",          tone: "urgent" },
          { value: "em_investigacao", label: "Em investigação" },
          { value: "concluida",       label: "Concluídas" },
        ]}
      />

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        getRowHref={(r) => `/ocorrencias/${r.id}`}
        empty={<EmptyState icon={AlertTriangleIcon} title="Nenhuma ocorrência encontrada." hint="Ajuste os filtros ou registre uma nova ocorrência." />}
      />
    </div>
  );
}
```

- [ ] **Step 6: Type-check + build + commit**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

```bash
git add lib/ocorrencia-state.ts tests/unit/ocorrencia-state.test.ts app/(app)/ocorrencias/page.tsx
git commit -m "feat(phase-5): rewrite /ocorrencias list with DataTable + FilterRail"
```

---

# Section C — Detail pages

### Task 11: `/afastamentos/[id]` detail rewrite

Two-column grid (1.6fr / 1fr): left = `<DetailHeader>` + `<ApprovalBar>` (when `situacao === "pendente"` AND current user is OH/admin) + main info card (`<FieldGrid>`) + anexos card; right = `<TimelineEvents>` (server-rendered from supabase) + metadata card.

**Files:**
- Modify: `app/(app)/afastamentos/[id]/page.tsx` (full rewrite)
- Modify: `components/afastamentos/afastamento-detail.tsx` (rewrite to compose FieldGrid)

- [ ] **Step 1: Rewrite `components/afastamentos/afastamento-detail.tsx`**

```tsx
import { FieldGrid, type Field } from "@/components/detail/field-grid";
import { AttachmentChip } from "@/components/detail/attachment-chip";

export interface AfastamentoFull {
  id: string;
  cpf: string;
  colaborador_nome: string;
  colaborador_setor: string | null;
  colaborador_cargo: string | null;
  data_inicio: string;
  data_fim: string | null;
  duracao: number | null;
  cid: string | null;
  emissor: { tipo: string; no: string; uf: string } | null;
  inss: boolean;
  acidente: boolean;
  internacao: boolean;
  email_remetente: string;
  arquivo_url: string | null;
  situacao: string;
  motivo_rejeicao: string | null;
  criado_em: string;
  empresas: { nome: string } | null;
  unidades: { nome: string } | null;
  afastamento_tipos: { rotulo: string } | null;
}

export function AfastamentoDetail({ a }: { a: AfastamentoFull }) {
  const flags = [a.inss && "INSS", a.acidente && "Acidente", a.internacao && "Internação"]
    .filter(Boolean)
    .join(", ");

  const fields: Field[] = [
    { label: "Colaborador",      value: a.colaborador_nome, full: true },
    { label: "CPF",              value: a.cpf, mono: true },
    { label: "Tipo",             value: a.afastamento_tipos?.rotulo ?? "—" },
    { label: "Empresa",          value: a.empresas?.nome ?? "—" },
    { label: "Unidade",          value: a.unidades?.nome ?? "—" },
    { label: "Setor",            value: a.colaborador_setor ?? "—" },
    { label: "Cargo",            value: a.colaborador_cargo ?? "—" },
    { label: "Início",           value: a.data_inicio, mono: true },
    { label: "Fim",              value: a.data_fim ?? "—", mono: true },
    { label: "Duração",          value: a.duracao != null ? `${a.duracao} dia(s)` : "—" },
    { label: "CID",              value: a.cid ?? "—", mono: true },
    { label: "Emissor",          value: a.emissor ? `${a.emissor.tipo} ${a.emissor.no}/${a.emissor.uf}` : "—" },
    { label: "Flags",            value: flags || "—" },
    { label: "Email do remetente", value: a.email_remetente, full: true },
  ];
  if (a.motivo_rejeicao) {
    fields.push({ label: "Motivo da rejeição", value: a.motivo_rejeicao, full: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Dados do afastamento
        </h2>
        <FieldGrid fields={fields} />
      </section>

      {a.arquivo_url && (
        <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
            Anexo
          </h2>
          <AttachmentChip
            href={`/api/public/afastamentos/upload/preview?path=${encodeURIComponent(a.arquivo_url)}`}
            filename={a.arquivo_url.split("/").pop() ?? "anexo"}
          />
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `app/(app)/afastamentos/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DetailHeader } from "@/components/detail/detail-header";
import { StatusPill } from "@/components/data/status-pill";
import { ApprovalBar } from "@/components/detail/approval-bar";
import { TimelineEvents, type TimelineEventRow } from "@/components/detail/timeline-events";
import { AfastamentoDetail, type AfastamentoFull } from "@/components/afastamentos/afastamento-detail";

async function userCanApprove(userId: string): Promise<boolean> {
  const supabase = await getSupabaseServer();
  const { data: u } = await supabase.from("usuarios").select("administrador").eq("id", userId).single();
  if (u?.administrador) return true;
  const { data: m } = await supabase
    .from("equipe_usuarios")
    .select("equipes!inner(codigo)")
    .eq("usuario_id", userId);
  return (m ?? []).some((row: { equipes: { codigo: string } | null }) => row.equipes?.codigo === "oh");
}

export default async function AfastamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: row }, { data: timelineData }] = await Promise.all([
    supabase
      .from("afastamentos")
      .select("*, empresas!inner(nome), unidades!inner(nome), afastamento_tipos!inner(rotulo)")
      .eq("id", id)
      .single()
      .returns<AfastamentoFull>(),
    supabase
      .from("eventos")
      .select("id, evento, ocorrido_em, usuarios:autor_id(nome)")
      .eq("tipo_entidade", "afastamento")
      .eq("entidade_id", id)
      .order("ocorrido_em", { ascending: false })
      .returns<TimelineEventRow[]>(),
  ]);
  if (!row) notFound();

  const canApprove = user ? await userCanApprove(user.id) : false;
  const showApprovalBar = row.situacao === "pendente" && canApprove;

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        breadcrumbs={[
          { label: "Painel", href: "/painel" },
          { label: "Afastamentos", href: "/afastamentos" },
          { label: row.colaborador_nome },
        ]}
        title={row.colaborador_nome}
        titleSuffix={row.cpf}
        meta={
          <>
            <StatusPill domain="afastamento" situacao={row.situacao} />
            <span>{row.afastamento_tipos?.rotulo ?? "—"}</span>
            <span className="font-mono">
              {row.data_inicio}
              {row.data_fim ? ` → ${row.data_fim}` : ""}
            </span>
          </>
        }
      />

      {showApprovalBar && <ApprovalBar afastamentoId={row.id} />}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <AfastamentoDetail a={row} />
        <aside className="flex flex-col gap-6">
          <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
              Histórico
            </h2>
            <TimelineEvents rows={timelineData ?? []} tipoEntidade="afastamento" />
          </section>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Delete now-unused legacy actions component**

```bash
git rm components/afastamentos/aprovar-rejeitar-actions.tsx
```

- [ ] **Step 4: Type-check + build + commit**

Run: `npx tsc --noEmit && npm run build`
Expected: clean. (If TS complains about the Supabase joined type on `equipes` in `userCanApprove`, replace with `.returns<{ equipes: { codigo: string } | null }[]>()` or cast — keep the runtime check identical.)

```bash
git add app/(app)/afastamentos/[id]/page.tsx components/afastamentos/afastamento-detail.tsx
git commit -m "feat(phase-5): rewrite /afastamentos/[id] detail with new primitives"
```

---

### Task 12: `/ocorrencias/[id]` detail rewrite

Same shape as Task 11 minus the approval bar. Adds an `<InvestigationStarter>` slot when `situacao === "aberta"`: a tonal banner that links to `/ocorrencias/[id]/investigacao`.

**Files:**
- Create: `components/ocorrencias/ocorrencia-detail-card.tsx`
- Create: `components/ocorrencias/investigation-starter.tsx`
- Modify: `app/(app)/ocorrencias/[id]/page.tsx`

- [ ] **Step 1: Create `components/ocorrencias/ocorrencia-detail-card.tsx`**

```tsx
import { FieldGrid, type Field } from "@/components/detail/field-grid";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";

export interface OcorrenciaFull {
  id: string;
  tipo: string;
  situacao: string;
  data_ocorrencia: string;
  email_remetente: string;
  descricao: string;
  criado_em: string;
  empresas: { nome: string } | null;
  unidades: { nome: string } | null;
}

export function OcorrenciaDetailCard({ o }: { o: OcorrenciaFull }) {
  const fields: Field[] = [
    { label: "Tipo",              value: ocorrenciaTipoLabel(o.tipo) },
    { label: "Empresa",           value: o.empresas?.nome ?? "—" },
    { label: "Unidade",           value: o.unidades?.nome ?? "—" },
    { label: "Data da ocorrência", value: new Date(o.data_ocorrencia).toLocaleString("pt-BR"), mono: true },
    { label: "Email do remetente", value: o.email_remetente, full: true },
    { label: "Descrição",          value: <p className="whitespace-pre-wrap">{o.descricao}</p>, full: true },
  ];
  return (
    <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
        Dados da ocorrência
      </h2>
      <FieldGrid fields={fields} />
    </section>
  );
}
```

- [ ] **Step 2: Create `components/ocorrencias/investigation-starter.tsx`**

```tsx
import Link from "next/link";
import { ArrowRightIcon, SearchIcon } from "lucide-react";

interface InvestigationStarterProps {
  ocorrenciaId: string;
  hasInvestigation: boolean;
}

export function InvestigationStarter({ ocorrenciaId, hasInvestigation }: InvestigationStarterProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-info-soft)] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-md bg-white text-[var(--color-info)]">
          <SearchIcon className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col">
          <p className="text-sm font-semibold text-foreground">
            {hasInvestigation ? "Investigação em andamento" : "Investigação ainda não iniciada"}
          </p>
          <p className="text-xs text-[var(--color-fg-muted)]">
            {hasInvestigation ? "Continue preenchendo as etapas para concluir." : "Abra a investigação para registrar contexto, causas e ações corretivas."}
          </p>
        </div>
      </div>
      <Link
        href={`/ocorrencias/${ocorrenciaId}/investigacao`}
        className="inline-flex items-center gap-1 rounded-md bg-[var(--color-info)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        {hasInvestigation ? "Continuar investigação" : "Iniciar investigação"}
        <ArrowRightIcon className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `app/(app)/ocorrencias/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DetailHeader } from "@/components/detail/detail-header";
import { StatusPill } from "@/components/data/status-pill";
import { TimelineEvents, type TimelineEventRow } from "@/components/detail/timeline-events";
import { OcorrenciaDetailCard, type OcorrenciaFull } from "@/components/ocorrencias/ocorrencia-detail-card";
import { InvestigationStarter } from "@/components/ocorrencias/investigation-starter";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";

type OcorrenciaWithInvestigacoes = OcorrenciaFull & {
  investigacoes: { id: string; situacao: string }[] | null;
};

export default async function OcorrenciaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  const [{ data: row }, { data: timelineData }] = await Promise.all([
    supabase
      .from("ocorrencias")
      .select("*, empresas!inner(nome), unidades!inner(nome), investigacoes(id, situacao)")
      .eq("id", id)
      .single()
      .returns<OcorrenciaWithInvestigacoes>(),
    supabase
      .from("eventos")
      .select("id, evento, ocorrido_em, usuarios:autor_id(nome)")
      .eq("tipo_entidade", "ocorrencia")
      .eq("entidade_id", id)
      .order("ocorrido_em", { ascending: false })
      .returns<TimelineEventRow[]>(),
  ]);
  if (!row) notFound();

  const hasInvestigation = (row.investigacoes ?? []).length > 0;

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        breadcrumbs={[
          { label: "Painel", href: "/painel" },
          { label: "Ocorrências", href: "/ocorrencias" },
          { label: ocorrenciaTipoLabel(row.tipo) },
        ]}
        title={ocorrenciaTipoLabel(row.tipo)}
        meta={
          <>
            <StatusPill domain="ocorrencia" situacao={row.situacao} />
            <span>{row.empresas?.nome ?? "—"}</span>
            <span className="font-mono">{new Date(row.data_ocorrencia).toLocaleString("pt-BR")}</span>
          </>
        }
      />

      {(row.situacao === "aberta" || row.situacao === "em_investigacao") && (
        <InvestigationStarter ocorrenciaId={row.id} hasInvestigation={hasInvestigation} />
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <OcorrenciaDetailCard o={row} />
        <aside className="flex flex-col gap-6">
          <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
              Histórico
            </h2>
            <TimelineEvents rows={timelineData ?? []} tipoEntidade="ocorrencia" />
          </section>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Delete the now-unused legacy timeline**

```bash
git rm components/eventos-timeline.tsx
```

(All known consumers — `app/(app)/afastamentos/[id]/page.tsx` and `app/(app)/ocorrencias/[id]/page.tsx` — were migrated in Tasks 11 and 12.)

- [ ] **Step 5: Type-check + build + commit**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

```bash
git add app/(app)/ocorrencias/[id]/page.tsx components/ocorrencias/ocorrencia-detail-card.tsx components/ocorrencias/investigation-starter.tsx
git commit -m "feat(phase-5): rewrite /ocorrencias/[id] detail + InvestigationStarter; drop legacy eventos-timeline"
```

---

### Task 13: `/ocorrencias/[id]/investigacao` stepped form

Replace the placeholder skeleton with the real stepped form: 4 steps (Contexto → Causas → Ações corretivas → Conclusão). Saves partial state via `POST /api/ocorrencias/[id]/investigacao` with `dados` payload; step 4 sends `situacao: "finalizada"`.

**Files:**
- Create: `components/ocorrencias/investigacao-form.tsx`
- Modify: `app/(app)/ocorrencias/[id]/investigacao/page.tsx`

- [ ] **Step 1: Create `components/ocorrencias/investigacao-form.tsx`**

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Stepper } from "@/components/detail/stepper";

const STEPS = [
  { key: "contexto",  label: "Contexto" },
  { key: "causas",    label: "Causas" },
  { key: "acoes",     label: "Ações corretivas" },
  { key: "conclusao", label: "Conclusão" },
] as const;

type DadosShape = {
  contexto?:  string;
  causas?:    string;
  acoes?:     string;
  conclusao?: string;
};

interface InvestigacaoFormProps {
  ocorrenciaId: string;
  initialDados: DadosShape;
}

export function InvestigacaoForm({ ocorrenciaId, initialDados }: InvestigacaoFormProps) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [dados, setDados] = React.useState<DadosShape>(initialDados);
  const [busy, setBusy] = React.useState(false);

  async function persist(opts: { finalize?: boolean }) {
    setBusy(true);
    const r = await fetch(`/api/ocorrencias/${ocorrenciaId}/investigacao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dados,
        situacao: opts.finalize ? "finalizada" : "em_andamento",
      }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.error ?? "Erro ao salvar.");
      return false;
    }
    return true;
  }

  async function onSave() {
    if (await persist({ finalize: false })) {
      toast.success("Progresso salvo.");
      router.refresh();
    }
  }

  async function onNext() {
    if (await persist({ finalize: false })) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  }

  async function onConclude() {
    if (await persist({ finalize: true })) {
      toast.success("Investigação concluída.");
      router.push(`/ocorrencias/${ocorrenciaId}`);
    }
  }

  const current = STEPS[step]!.key;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="flex flex-col gap-6">
      <Stepper steps={STEPS.map((s) => ({ label: s.label }))} current={step} />

      <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          {STEPS[step]!.label}
        </h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor={current}>
            {current === "contexto"  && "Descreva o que aconteceu, quando e onde."}
            {current === "causas"    && "Liste as causas identificadas (técnicas, organizacionais, humanas)."}
            {current === "acoes"     && "Quais ações corretivas serão tomadas? Por quem e até quando?"}
            {current === "conclusao" && "Resumo final e lições aprendidas."}
          </Label>
          <Textarea
            id={current}
            rows={8}
            value={dados[current] ?? ""}
            onChange={(e) => setDados({ ...dados, [current]: e.target.value })}
            placeholder="Digite aqui…"
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(s - 1, 0))}
          disabled={busy || step === 0}
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Anterior
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onSave} disabled={busy}>
            Salvar progresso
          </Button>
          {isLast ? (
            <Button
              onClick={onConclude}
              disabled={busy}
              className="bg-[var(--color-success)] text-white hover:bg-[var(--color-success)]/90"
            >
              <CheckIcon className="size-4" aria-hidden="true" />
              Concluir investigação
            </Button>
          ) : (
            <Button onClick={onNext} disabled={busy}>
              Próximo
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `app/(app)/ocorrencias/[id]/investigacao/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DetailHeader } from "@/components/detail/detail-header";
import { StatusPill } from "@/components/data/status-pill";
import { TimelineEvents, type TimelineEventRow } from "@/components/detail/timeline-events";
import { InvestigacaoForm } from "@/components/ocorrencias/investigacao-form";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";

interface OcorrenciaSummary {
  id: string;
  tipo: string;
  situacao: string;
  data_ocorrencia: string;
  investigacoes: { id: string; situacao: string; dados: Record<string, unknown> | null }[] | null;
}

export default async function InvestigacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  const [{ data: row }, { data: timelineData }] = await Promise.all([
    supabase
      .from("ocorrencias")
      .select("id, tipo, situacao, data_ocorrencia, investigacoes(id, situacao, dados)")
      .eq("id", id)
      .single()
      .returns<OcorrenciaSummary>(),
    supabase
      .from("eventos")
      .select("id, evento, ocorrido_em, usuarios:autor_id(nome)")
      .eq("tipo_entidade", "ocorrencia")
      .eq("entidade_id", id)
      .order("ocorrido_em", { ascending: false })
      .returns<TimelineEventRow[]>(),
  ]);
  if (!row) notFound();

  const initialDados = (row.investigacoes?.[0]?.dados ?? {}) as {
    contexto?: string; causas?: string; acoes?: string; conclusao?: string;
  };

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        breadcrumbs={[
          { label: "Painel", href: "/painel" },
          { label: "Ocorrências", href: "/ocorrencias" },
          { label: ocorrenciaTipoLabel(row.tipo), href: `/ocorrencias/${row.id}` },
          { label: "Investigação" },
        ]}
        title="Investigação"
        meta={
          <>
            <StatusPill domain="ocorrencia" situacao={row.situacao} />
            <span>{ocorrenciaTipoLabel(row.tipo)}</span>
            <span className="font-mono">{new Date(row.data_ocorrencia).toLocaleString("pt-BR")}</span>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <InvestigacaoForm ocorrenciaId={row.id} initialDados={initialDados} />
        <aside className="flex flex-col gap-6">
          <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
              Histórico
            </h2>
            <TimelineEvents rows={timelineData ?? []} tipoEntidade="ocorrencia" />
          </section>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check + build + commit**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

```bash
git add app/(app)/ocorrencias/[id]/investigacao/page.tsx components/ocorrencias/investigacao-form.tsx
git commit -m "feat(phase-5): stepped investigação form replacing the placeholder skeleton"
```

---

# Section D — Admin restyle

### Task 14: `<AdminCrudTable>` refactor + admin home + 3 simple CRUD pages

Refactor the existing `<AdminCrudTable>` to render rows through `<DataTable>` and to move row-edit + create into a shadcn `Sheet` side panel. The component's external API stays the same (`endpoint`, `columns`, `initial`) so empresas / unidades / afastamento-tipos pages need only page-head wrapper restyling.

**Files:**
- Modify: `components/admin/crud-table.tsx` (full rewrite, same props)
- Modify: `app/(admin)/admin/page.tsx` (admin home — restyle with cards)
- Modify: `app/(admin)/admin/empresas/page.tsx`
- Modify: `app/(admin)/admin/unidades/page.tsx`
- Modify: `app/(admin)/admin/afastamento-tipos/page.tsx`

- [ ] **Step 1: Rewrite `components/admin/crud-table.tsx`**

```tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/data/empty-state";
import { DatabaseIcon } from "lucide-react";

export type Column = {
  key: string;
  label: string;
  type?: "text" | "checkbox" | "number";
  readonly?: boolean;
};

interface AdminCrudTableProps {
  endpoint: string;
  columns: Column[];
  initial: Record<string, unknown>;
  /** Resource label used in Sheet/Dialog copy. Defaults to "registro". */
  resourceLabel?: string;
}

export function AdminCrudTable({ endpoint, columns, initial, resourceLabel = "registro" }: AdminCrudTableProps) {
  const [rows, setRows] = React.useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState<Record<string, unknown>>(initial);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const data = await fetch(endpoint).then((r) => r.json());
    setRows(data);
  }, [endpoint]);

  React.useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(initial);
    setFormOpen(true);
  }
  function openEdit(row: Record<string, unknown> & { id: string }) {
    setEditingId(row.id);
    setForm({ ...initial, ...row });
    setFormOpen(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const url = editingId ? `${endpoint}/${editingId}` : endpoint;
    const method = editingId ? "PATCH" : "POST";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.error ?? "Erro");
      return;
    }
    toast.success(editingId ? "Atualizado." : "Criado.");
    setFormOpen(false);
    load();
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    setBusy(true);
    const r = await fetch(`${endpoint}/${confirmDeleteId}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) {
      toast.error("Erro ao excluir.");
      return;
    }
    toast.success("Excluído.");
    setConfirmDeleteId(null);
    load();
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Sheet open={formOpen} onOpenChange={setFormOpen}>
          <SheetTrigger
            render={
              <Button onClick={openCreate}>
                <PlusIcon className="size-4" aria-hidden="true" />
                Novo {resourceLabel}
              </Button>
            }
          />
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{editingId ? `Editar ${resourceLabel}` : `Novo ${resourceLabel}`}</SheetTitle>
              <SheetDescription>
                Preencha os campos abaixo. Mudanças entram em vigor imediatamente.
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={submitForm} className="flex flex-col gap-4 p-4">
              {columns.filter((c) => !c.readonly).map((c) => (
                <div key={c.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={c.key}>{c.label}</Label>
                  {c.type === "checkbox" ? (
                    <Checkbox
                      id={c.key}
                      checked={Boolean(form[c.key])}
                      onCheckedChange={(v) => setForm({ ...form, [c.key]: Boolean(v) })}
                    />
                  ) : (
                    <Input
                      id={c.key}
                      type={c.type ?? "text"}
                      value={(form[c.key] as string | number | undefined) ?? ""}
                      onChange={(e) => setForm({
                        ...form,
                        [c.key]: c.type === "number" ? Number(e.target.value) : e.target.value,
                      })}
                    />
                  )}
                </div>
              ))}
              <SheetFooter>
                <SheetClose render={<Button variant="outline" type="button">Cancelar</Button>} />
                <Button type="submit" disabled={busy}>
                  {editingId ? "Salvar alterações" : "Adicionar"}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={DatabaseIcon} title={`Nenhum ${resourceLabel} cadastrado.`} hint={`Clique em "Novo ${resourceLabel}" para começar.`} />
      ) : (
        <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--color-bg-subtle)]">
                {columns.map((c) => (
                  <TableHead key={c.key} className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
                    {c.label}
                  </TableHead>
                ))}
                <TableHead className="w-24 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-[var(--color-bg-subtle)]">
                  {columns.map((c) => (
                    <TableCell key={c.key} className="text-sm">
                      {c.type === "checkbox"
                        ? (row[c.key] ? "Sim" : "Não")
                        : String(row[c.key] ?? "—")}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(row)} aria-label="Editar">
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteId(row.id)}
                        aria-label="Excluir"
                        className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={Boolean(confirmDeleteId)} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {resourceLabel}?</DialogTitle>
            <DialogDescription>Essa ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancelar</Button>} />
            <Button
              onClick={confirmDelete}
              disabled={busy}
              className="bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90"
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

(If a `DELETE /<endpoint>/<id>` route doesn't exist for some resources, the delete button will surface an error — that's acceptable for this phase; backend coverage is outside scope.)

- [ ] **Step 2: Restyle `app/(admin)/admin/page.tsx` (admin home)**

```tsx
import Link from "next/link";
import {
  Building2Icon, FactoryIcon, UsersIcon, UserCogIcon, ListTreeIcon, SettingsIcon,
} from "lucide-react";

const ITEMS = [
  { href: "/admin/usuarios",          title: "Usuários",         desc: "Convidar e gerenciar usuários da plataforma.",         icon: UserCogIcon },
  { href: "/admin/equipes",           title: "Equipes",          desc: "Atribuir membros às equipes operacionais.",            icon: UsersIcon },
  { href: "/admin/empresas",          title: "Empresas",         desc: "Empresas tenantes — código SOC e Fluig.",              icon: Building2Icon },
  { href: "/admin/unidades",          title: "Unidades",         desc: "Unidades operacionais por empresa.",                   icon: FactoryIcon },
  { href: "/admin/afastamento-tipos", title: "Tipos de afastamento", desc: "Catálogo de tipos com regras de aprovação.",      icon: ListTreeIcon },
  { href: "/admin/configuracoes",     title: "Configurações",    desc: "Email da folha de pagamentos e integrações.",          icon: SettingsIcon },
];

export default function AdminHome() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/painel" className="hover:text-foreground">Painel</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span className="text-foreground">Administração</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">Gerencie cadastros e configurações da plataforma.</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              className="group flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-xs)] transition hover:shadow-[var(--shadow-md)]"
            >
              <span className="grid size-10 place-items-center rounded-md bg-[var(--brand-primary-50)] text-[var(--brand-primary-600)]">
                <i.icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex flex-1 flex-col">
                <span className="text-sm font-semibold text-foreground">{i.title}</span>
                <span className="text-xs text-[var(--color-fg-muted)]">{i.desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Restyle each CRUD-backed admin page (page-head wrapper + resourceLabel)**

`app/(admin)/admin/empresas/page.tsx`:

```tsx
"use client";
import Link from "next/link";
import { AdminCrudTable } from "@/components/admin/crud-table";

export default function EmpresasPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/admin" className="hover:text-foreground">Administração</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span className="text-foreground">Empresas</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
      </header>
      <AdminCrudTable
        endpoint="/api/admin/empresas"
        resourceLabel="empresa"
        initial={{ nome: "", razao_social: "", cnpj: "", codigo_soc: "", codigo_fluig: "", ativo: true }}
        columns={[
          { key: "nome",         label: "Nome" },
          { key: "razao_social", label: "Razão Social" },
          { key: "cnpj",         label: "CNPJ" },
          { key: "codigo_soc",   label: "Cód SOC" },
          { key: "codigo_fluig", label: "Cód Fluig" },
          { key: "ativo",        label: "Ativo", type: "checkbox" },
        ]}
      />
    </div>
  );
}
```

`app/(admin)/admin/unidades/page.tsx`:

```tsx
"use client";
import Link from "next/link";
import { AdminCrudTable } from "@/components/admin/crud-table";

export default function UnidadesPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/admin" className="hover:text-foreground">Administração</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span className="text-foreground">Unidades</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Unidades</h1>
      </header>
      <AdminCrudTable
        endpoint="/api/admin/unidades"
        resourceLabel="unidade"
        initial={{ codigo: "", nome: "", ativo: true }}
        columns={[
          { key: "codigo", label: "Código" },
          { key: "nome",   label: "Nome" },
          { key: "ativo",  label: "Ativo", type: "checkbox" },
        ]}
      />
    </div>
  );
}
```

`app/(admin)/admin/afastamento-tipos/page.tsx`:

```tsx
"use client";
import Link from "next/link";
import { AdminCrudTable } from "@/components/admin/crud-table";

export default function AfastamentoTiposPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/admin" className="hover:text-foreground">Administração</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span className="text-foreground">Tipos de afastamento</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Tipos de afastamento</h1>
      </header>
      <AdminCrudTable
        endpoint="/api/admin/afastamento-tipos"
        resourceLabel="tipo"
        initial={{ codigo: "", rotulo: "", requer_aprovacao: false, ordem: 0, ativo: true }}
        columns={[
          { key: "codigo",           label: "Código" },
          { key: "rotulo",           label: "Rótulo" },
          { key: "requer_aprovacao", label: "Requer aprovação", type: "checkbox" },
          { key: "ordem",            label: "Ordem", type: "number" },
          { key: "ativo",            label: "Ativo", type: "checkbox" },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 4: Type-check + build + commit**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

```bash
git add components/admin/crud-table.tsx app/(admin)/admin/page.tsx app/(admin)/admin/empresas/page.tsx app/(admin)/admin/unidades/page.tsx app/(admin)/admin/afastamento-tipos/page.tsx
git commit -m "feat(phase-5): restyle admin home + CrudTable (Sheet edit, DataTable view)"
```

---

### Task 15: usuarios + equipes + configuracoes restyle

These three admin pages have custom UIs and don't go through `<AdminCrudTable>`. Restyle each with the page-head wrapper, Card sections, Sheet-based invite flow for usuarios, and consistent form controls.

**Files:**
- Modify: `app/(admin)/admin/usuarios/page.tsx`
- Modify: `app/(admin)/admin/equipes/page.tsx`
- Modify: `app/(admin)/admin/configuracoes/page.tsx`

- [ ] **Step 1: Rewrite `app/(admin)/admin/usuarios/page.tsx`**

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/data/empty-state";
import { UsersIcon } from "lucide-react";

interface Usuario {
  id: string;
  email: string;
  nome: string | null;
  sobrenome: string | null;
  administrador: boolean;
  ativo: boolean;
}

export default function UsuariosPage() {
  const [rows, setRows] = React.useState<Usuario[]>([]);
  const [form, setForm] = React.useState({ email: "", nome: "", sobrenome: "", administrador: false });
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const data = await fetch("/api/admin/usuarios").then((r) => r.json());
    setRows(data);
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.error ?? "Erro");
      return;
    }
    toast.success("Convite enviado.");
    setForm({ email: "", nome: "", sobrenome: "", administrador: false });
    setOpen(false);
    load();
  }

  async function toggle(id: string, field: "administrador" | "ativo", value: boolean) {
    const r = await fetch(`/api/admin/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!r.ok) {
      toast.error("Erro ao atualizar.");
      return;
    }
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div className="flex flex-col">
          <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
            <Link href="/admin" className="hover:text-foreground">Administração</Link>
            <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
            <span className="text-foreground">Usuários</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
          <p className="text-sm text-[var(--color-fg-muted)]">{rows.length} usuário{rows.length === 1 ? "" : "s"}</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button><PlusIcon className="size-4" aria-hidden="true" />Convidar usuário</Button>} />
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Convidar usuário</SheetTitle>
              <SheetDescription>O usuário receberá um email para definir senha e ativar a conta.</SheetDescription>
            </SheetHeader>
            <form onSubmit={invite} className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sobrenome">Sobrenome</Label>
                <Input id="sobrenome" value={form.sobrenome} onChange={(e) => setForm({ ...form, sobrenome: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="admin" checked={form.administrador} onCheckedChange={(v) => setForm({ ...form, administrador: Boolean(v) })} />
                <Label htmlFor="admin">Administrador</Label>
              </div>
              <SheetFooter>
                <SheetClose render={<Button type="button" variant="outline">Cancelar</Button>} />
                <Button type="submit" disabled={busy}>Enviar convite</Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </header>

      {rows.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Nenhum usuário cadastrado." hint="Convide o primeiro usuário para começar." />
      ) : (
        <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--color-bg-subtle)]">
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">Nome</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">Email</TableHead>
                <TableHead className="w-20 text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">Admin</TableHead>
                <TableHead className="w-20 text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">Ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-[var(--color-bg-subtle)]">
                  <TableCell className="text-sm">{[r.nome, r.sobrenome].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell className="text-sm font-mono">{r.email}</TableCell>
                  <TableCell className="text-center">
                    <Checkbox checked={r.administrador} onCheckedChange={(v) => toggle(r.id, "administrador", Boolean(v))} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox checked={r.ativo} onCheckedChange={(v) => toggle(r.id, "ativo", Boolean(v))} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `app/(admin)/admin/equipes/page.tsx`**

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Membro {
  usuario_id: string;
  usuarios: { nome: string | null; email: string } | null;
}
interface Equipe {
  id: string;
  codigo: string;
  nome: string;
  equipe_usuarios: Membro[] | null;
}
interface Usuario {
  id: string;
  email: string;
  nome: string | null;
}

export default function EquipesPage() {
  const [equipes, setEquipes] = React.useState<Equipe[]>([]);
  const [usuarios, setUsuarios] = React.useState<Usuario[]>([]);

  const load = React.useCallback(async () => {
    const [e, u] = await Promise.all([
      fetch("/api/admin/equipes").then((r) => r.json()),
      fetch("/api/admin/usuarios").then((r) => r.json()),
    ]);
    setEquipes(e);
    setUsuarios(u);
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function add(equipeId: string, usuarioId: string) {
    const r = await fetch(`/api/admin/equipes/${equipeId}/membros`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario_id: usuarioId }),
    });
    if (!r.ok) {
      toast.error("Erro ao adicionar.");
      return;
    }
    load();
  }
  async function remove(equipeId: string, usuarioId: string) {
    const r = await fetch(`/api/admin/equipes/${equipeId}/membros?usuario_id=${usuarioId}`, { method: "DELETE" });
    if (!r.ok) {
      toast.error("Erro ao remover.");
      return;
    }
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/admin" className="hover:text-foreground">Administração</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span className="text-foreground">Equipes</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Equipes</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">Gerencie a composição de cada equipe operacional.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {equipes.map((e) => {
          const membros = e.equipe_usuarios ?? [];
          const disponíveis = usuarios.filter((u) => !membros.some((m) => m.usuario_id === u.id));
          return (
            <section
              key={e.id}
              className="rounded-md border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-xs)]"
            >
              <header className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{e.nome}</h2>
                  <p className="font-mono text-xs text-[var(--color-fg-muted)]">{e.codigo}</p>
                </div>
                <span className="text-xs text-[var(--color-fg-muted)]">
                  {membros.length} membro{membros.length === 1 ? "" : "s"}
                </span>
              </header>
              <ul className="mb-3 flex flex-col divide-y divide-[var(--color-border)]">
                {membros.map((m) => (
                  <li key={m.usuario_id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      <span className="font-medium">{m.usuarios?.nome ?? "—"}</span>
                      <span className="ml-2 font-mono text-xs text-[var(--color-fg-muted)]">{m.usuarios?.email}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Remover membro"
                      onClick={() => remove(e.id, m.usuario_id)}
                      className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </li>
                ))}
                {membros.length === 0 && (
                  <li className="py-3 text-sm text-[var(--color-fg-muted)]">Sem membros ainda.</li>
                )}
              </ul>
              <Select
                value=""
                onValueChange={(v) => { if (v) add(e.id, v); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Adicionar membro…" />
                </SelectTrigger>
                <SelectContent>
                  {disponíveis.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `app/(admin)/admin/configuracoes/page.tsx`**

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ConfiguracoesPage() {
  const [emailFolha, setEmailFolha] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/admin/configuracoes")
      .then((r) => r.json())
      .then((c) => setEmailFolha(c?.email_folha ?? ""));
  }, []);

  async function save() {
    setBusy(true);
    const r = await fetch("/api/admin/configuracoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email_folha: emailFolha }),
    });
    setBusy(false);
    if (!r.ok) {
      toast.error("Erro ao salvar.");
      return;
    }
    toast.success("Salvo.");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/admin" className="hover:text-foreground">Administração</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span className="text-foreground">Configurações</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
      </header>

      <section className="max-w-2xl rounded-md border border-[var(--color-border)] bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Notificações
        </h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email-folha">Email da Folha de Pagamentos</Label>
          <Input
            id="email-folha"
            type="email"
            value={emailFolha}
            onChange={(e) => setEmailFolha(e.target.value)}
            placeholder="folha@empresa.com"
          />
          <p className="text-xs text-[var(--color-fg-muted)]">
            Para onde notificações de afastamentos aprovados são enviadas.
          </p>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={busy}>Salvar</Button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Type-check + build + commit**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

```bash
git add app/(admin)/admin/usuarios/page.tsx app/(admin)/admin/equipes/page.tsx app/(admin)/admin/configuracoes/page.tsx
git commit -m "feat(phase-5): restyle admin usuarios + equipes + configuracoes"
```

---

# Section E — Public forms

### Task 16: Public form shell + `/forms/afastamentos` restyle + edit-token restyle

Build a shared `<PublicFormShell>` (info banner + back link + content slot), then rewrite `AfastamentoForm` to use shadcn `Form`/`Input`/`Select` plus the shell. Rewrite the edit-token page to wrap the form in the shell with the rejection-reason callout.

**Files:**
- Create: `components/forms/public-form-shell.tsx`
- Modify: `components/forms/cpf-lookup.tsx` (restyle inline; keep API)
- Modify: `components/forms/file-upload.tsx` (restyle inline; keep API)
- Modify: `components/forms/afastamento-form.tsx` (full rewrite)
- Modify: `app/(public)/forms/afastamentos/page.tsx`
- Modify: `app/(public)/afastamentos/editar/[token]/page.tsx`

- [ ] **Step 1: Create `components/forms/public-form-shell.tsx`**

```tsx
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

interface PublicFormShellProps {
  title: string;
  /** Tonal banner copy explaining the form. */
  banner: string;
  /** Top-of-form callout (e.g. rejection motivo). Renders above the form body. */
  callout?: React.ReactNode;
  /** Form body content. */
  children: React.ReactNode;
}

export function PublicFormShell({ title, banner, callout, children }: PublicFormShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[var(--brand-primary-600)] hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Voltar ao portal
      </Link>
      <header className="rounded-md border border-[var(--color-border)] bg-[var(--brand-primary-50)] p-4">
        <h1 className="text-xl font-semibold text-[var(--brand-primary-700)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--brand-primary-700)]/80">{banner}</p>
      </header>
      {callout}
      <div className="rounded-md border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-xs)]">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Restyle `components/forms/cpf-lookup.tsx`**

```tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CpfLookup({ onResolved }: { onResolved: (data: { cpf: string; nome: string; setor: string; cargo: string; codigo_soc: string; empresa_id?: string; unidade_id?: string }) => void }) {
  const [cpf, setCpf] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function lookup() {
    if (!/^\d{11}$/.test(cpf)) {
      toast.error("CPF inválido");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/public/afastamentos/lookup-cpf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpf }),
    });
    setLoading(false);
    if (!res.ok) {
      toast.error("Erro ao consultar SOC");
      return;
    }
    const data = await res.json();
    if (!data) {
      toast.error("CPF não encontrado");
      return;
    }
    onResolved(data);
  }

  return (
    <div className="flex gap-2">
      <Input
        type="text"
        inputMode="numeric"
        placeholder="CPF (11 dígitos)"
        value={cpf}
        onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
        maxLength={11}
        className="font-mono"
      />
      <Button type="button" onClick={lookup} disabled={loading}>
        <SearchIcon className="size-4" aria-hidden="true" />
        {loading ? "Buscando…" : "Buscar"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Restyle `components/forms/file-upload.tsx`**

```tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { UploadIcon } from "lucide-react";

export function FileUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = React.useState(false);
  const [filename, setFilename] = React.useState<string | null>(null);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFilename(file.name);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/public/afastamentos/upload", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) {
      toast.error("Erro no upload");
      setFilename(null);
      return;
    }
    const { url } = await res.json();
    onUploaded(url);
  }

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] p-4 text-sm hover:border-[var(--brand-primary-600)] hover:bg-[var(--brand-primary-50)]">
      <UploadIcon className="size-5 text-[var(--color-fg-muted)]" aria-hidden="true" />
      <span className="flex flex-col">
        <span className="font-medium text-foreground">
          {uploading ? "Enviando…" : filename ?? "Selecionar anexo"}
        </span>
        <span className="text-xs text-[var(--color-fg-muted)]">PDF / JPG / PNG, até 10MB</span>
      </span>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={handle}
        disabled={uploading}
        className="sr-only"
      />
    </label>
  );
}
```

- [ ] **Step 4: Rewrite `components/forms/afastamento-form.tsx`**

```tsx
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AfastamentoInputSchema, type AfastamentoInput } from "@/lib/validation/afastamento";
import { FileUpload } from "./file-upload";
import { CpfLookup } from "./cpf-lookup";

type Lookups = {
  empresas: { id: string; nome: string }[];
  unidades: { id: string; nome: string }[];
  tipos:    { id: string; codigo: string; rotulo: string }[];
};

export function AfastamentoForm({
  lookups,
  initial,
}: {
  lookups: Lookups;
  initial?: Partial<AfastamentoInput> & { token?: string };
}) {
  const router = useRouter();
  const form = useForm<AfastamentoInput>({
    resolver: zodResolver(AfastamentoInputSchema),
    defaultValues: initial as AfastamentoInput | undefined,
  });
  const [arquivoUrl, setArquivoUrl] = React.useState<string | undefined>(initial?.arquivo_url);

  async function onSubmit(values: AfastamentoInput) {
    const payload = { ...values, arquivo_url: arquivoUrl };
    const url = initial?.token
      ? `/api/public/afastamentos/${initial.token}`
      : "/api/public/afastamentos";
    const method = initial?.token ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const { error } = await res.json();
      toast.error(error ?? "Erro");
      return;
    }
    toast.success("Enviado.");
    router.push("/");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label>CPF</Label>
        <CpfLookup
          onResolved={(data) => {
            form.setValue("cpf", data.cpf);
            form.setValue("colaborador_nome", data.nome);
            form.setValue("colaborador_setor", data.setor);
            form.setValue("colaborador_cargo", data.cargo);
            form.setValue("colaborador_codigo_soc", data.codigo_soc);
            if (data.empresa_id) form.setValue("empresa_id", data.empresa_id);
            if (data.unidade_id) form.setValue("unidade_id", data.unidade_id);
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="colaborador_nome">Nome do colaborador</Label>
        <Input id="colaborador_nome" {...form.register("colaborador_nome")} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="empresa_id">Empresa</Label>
          <Select
            value={form.watch("empresa_id") ?? ""}
            onValueChange={(v) => form.setValue("empresa_id", v)}
          >
            <SelectTrigger id="empresa_id"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {lookups.empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unidade_id">Unidade</Label>
          <Select
            value={form.watch("unidade_id") ?? ""}
            onValueChange={(v) => form.setValue("unidade_id", v)}
          >
            <SelectTrigger id="unidade_id"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {lookups.unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tipo_id">Tipo de afastamento</Label>
        <Select
          value={form.watch("tipo_id") ?? ""}
          onValueChange={(v) => form.setValue("tipo_id", v)}
        >
          <SelectTrigger id="tipo_id"><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {lookups.tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.rotulo}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="data_inicio">Data início</Label>
          <Input id="data_inicio" type="date" {...form.register("data_inicio")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="data_fim">Data fim</Label>
          <Input id="data_fim" type="date" {...form.register("data_fim")} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email_remetente">Email para retorno</Label>
        <Input id="email_remetente" type="email" {...form.register("email_remetente")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Anexo</Label>
        <FileUpload onUploaded={setArquivoUrl} />
        {arquivoUrl && <p className="text-xs text-[var(--color-fg-muted)]">Anexo carregado.</p>}
      </div>

      <Button type="submit" disabled={form.formState.isSubmitting}>
        Enviar
      </Button>
    </form>
  );
}
```

(Note: this form uses controlled `Select` via `form.watch` + `form.setValue` because shadcn `Select` doesn't bind to native `register`. The hidden inputs that `react-hook-form` previously relied on via `register` are replaced by direct field updates, which `zodResolver` then validates. If submitting fails type checks, ensure `empresa_id`/`unidade_id`/`tipo_id` are set via the `data-*` props rather than the native value attribute — keep using `form.watch` + `form.setValue`.)

- [ ] **Step 5: Rewrite `app/(public)/forms/afastamentos/page.tsx`**

```tsx
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AfastamentoForm } from "@/components/forms/afastamento-form";
import { PublicFormShell } from "@/components/forms/public-form-shell";

export default async function AfastamentoPublicForm() {
  const supabase = getSupabaseAdmin();
  const [{ data: empresas }, { data: unidades }, { data: tipos }] = await Promise.all([
    supabase.from("empresas").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("afastamento_tipos").select("id, codigo, rotulo").eq("ativo", true).order("ordem"),
  ]);

  return (
    <PublicFormShell
      title="Registrar afastamento"
      banner="Use este formulário para registrar afastamentos médicos, INSS, acidentes ou outras ausências. Você receberá um email com o status da solicitação."
    >
      <AfastamentoForm lookups={{ empresas: empresas ?? [], unidades: unidades ?? [], tipos: tipos ?? [] }} />
    </PublicFormShell>
  );
}
```

- [ ] **Step 6: Rewrite `app/(public)/afastamentos/editar/[token]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AfastamentoForm } from "@/components/forms/afastamento-form";
import { PublicFormShell } from "@/components/forms/public-form-shell";

export default async function EditarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: a } = await supabase
    .from("afastamentos")
    .select("*, empresas!inner(id, nome), unidades!inner(id, nome), afastamento_tipos!inner(id, codigo, rotulo)")
    .eq("token_edicao", token)
    .single();
  if (!a) notFound();

  if (a.situacao !== "rejeitado") {
    return (
      <PublicFormShell
        title="Link indisponível"
        banner="Este link só pode ser usado enquanto o registro estiver rejeitado."
      >
        <p className="text-sm text-[var(--color-fg-muted)]">
          Se você acredita que está vendo esta mensagem por engano, entre em contato com o RH.
        </p>
      </PublicFormShell>
    );
  }

  const [{ data: empresas }, { data: unidades }, { data: tipos }] = await Promise.all([
    supabase.from("empresas").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("afastamento_tipos").select("id, codigo, rotulo").eq("ativo", true).order("ordem"),
  ]);

  return (
    <PublicFormShell
      title="Corrigir afastamento"
      banner="Seu envio foi rejeitado. Corrija as informações abaixo e reenvie."
      callout={
        <div className="rounded-md border border-[var(--brand-accent-500)]/40 bg-[var(--color-accent-soft)] px-4 py-3 text-sm">
          <strong className="text-[var(--brand-accent-600)]">Motivo da rejeição:</strong>{" "}
          <span className="text-foreground">{a.motivo_rejeicao}</span>
        </div>
      }
    >
      <AfastamentoForm
        lookups={{ empresas: empresas ?? [], unidades: unidades ?? [], tipos: tipos ?? [] }}
        initial={{
          empresa_id: a.empresa_id, unidade_id: a.unidade_id, tipo_id: a.tipo_id,
          cpf: a.cpf, colaborador_nome: a.colaborador_nome,
          colaborador_setor: a.colaborador_setor, colaborador_cargo: a.colaborador_cargo,
          colaborador_codigo_soc: a.colaborador_codigo_soc,
          data_inicio: a.data_inicio, data_fim: a.data_fim, duracao: a.duracao,
          cid: a.cid, email_remetente: a.email_remetente,
          arquivo_url: a.arquivo_url, token,
        }}
      />
    </PublicFormShell>
  );
}
```

- [ ] **Step 7: Type-check + build + commit**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

```bash
git add components/forms/public-form-shell.tsx components/forms/cpf-lookup.tsx components/forms/file-upload.tsx components/forms/afastamento-form.tsx app/(public)/forms/afastamentos/page.tsx app/(public)/afastamentos/editar/[token]/page.tsx
git commit -m "feat(phase-5): public form shell + restyled afastamento form + edit-token page"
```

---

### Task 17: `/forms/ocorrencias` multi-step form

Per spec: Identificação → Detalhes → Anexos. Uses `<Stepper>` and `<PublicFormShell>`. Form state held in client component; submit only on the last step.

**Files:**
- Modify: `components/forms/ocorrencia-form.tsx` (full rewrite)
- Modify: `app/(public)/forms/ocorrencias/page.tsx`

- [ ] **Step 1: Rewrite `components/forms/ocorrencia-form.tsx`**

```tsx
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stepper } from "@/components/detail/stepper";
import { FileUpload } from "./file-upload";
import { OcorrenciaInputSchema, type OcorrenciaInput } from "@/lib/validation/ocorrencia";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";
import TIPOS from "@/lib/data/ocorrencia_tipos.json";

const STEPS = [
  { label: "Identificação" },
  { label: "Detalhes" },
  { label: "Anexos" },
];

const STEP_FIELDS: Array<Array<keyof OcorrenciaInput>> = [
  ["empresa_id", "unidade_id", "tipo"],
  ["data_ocorrencia", "email_remetente", "descricao"],
  [],
];

export function OcorrenciaForm({ lookups }: { lookups: { empresas: { id: string; nome: string }[]; unidades: { id: string; nome: string }[] } }) {
  const router = useRouter();
  const form = useForm<OcorrenciaInput>({ resolver: zodResolver(OcorrenciaInputSchema), mode: "onBlur" });
  const [step, setStep] = React.useState(0);
  const [arquivoUrl, setArquivoUrl] = React.useState<string | undefined>(undefined);

  async function nextStep() {
    const valid = await form.trigger(STEP_FIELDS[step]);
    if (!valid) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function onSubmit(values: OcorrenciaInput) {
    const payload = { ...values, arquivo_url: arquivoUrl };
    const r = await fetch("/api/public/ocorrencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.error ?? "Erro");
      return;
    }
    toast.success("Ocorrência registrada.");
    router.push("/");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="empresa_id">Empresa</Label>
            <Select value={form.watch("empresa_id") ?? ""} onValueChange={(v) => form.setValue("empresa_id", v)}>
              <SelectTrigger id="empresa_id"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {lookups.empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="unidade_id">Unidade</Label>
            <Select value={form.watch("unidade_id") ?? ""} onValueChange={(v) => form.setValue("unidade_id", v)}>
              <SelectTrigger id="unidade_id"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {lookups.unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tipo">Tipo</Label>
            <Select value={form.watch("tipo") ?? ""} onValueChange={(v) => form.setValue("tipo", v)}>
              <SelectTrigger id="tipo"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(TIPOS as string[]).map((t) => <SelectItem key={t} value={t}>{ocorrenciaTipoLabel(t)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="data_ocorrencia">Data e hora da ocorrência</Label>
            <Input id="data_ocorrencia" type="datetime-local" {...form.register("data_ocorrencia")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email_remetente">Email para retorno</Label>
            <Input id="email_remetente" type="email" {...form.register("email_remetente")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" rows={6} {...form.register("descricao")} placeholder="O que aconteceu, quando e onde…" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-fg-muted)]">
            Você pode anexar fotos, vídeos, laudos ou outros documentos. Opcional.
          </p>
          <FileUpload onUploaded={setArquivoUrl} />
          {arquivoUrl && <p className="text-xs text-[var(--color-fg-muted)]">Anexo carregado.</p>}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={step === 0}>
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Anterior
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={nextStep}>
            Próximo
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Enviar ocorrência
          </Button>
        )}
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Rewrite `app/(public)/forms/ocorrencias/page.tsx`**

```tsx
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { OcorrenciaForm } from "@/components/forms/ocorrencia-form";
import { PublicFormShell } from "@/components/forms/public-form-shell";

export default async function OcorrenciaPublicForm() {
  const supabase = getSupabaseAdmin();
  const [{ data: empresas }, { data: unidades }] = await Promise.all([
    supabase.from("empresas").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  return (
    <PublicFormShell
      title="Registrar ocorrência"
      banner="Use este formulário para reportar quase-acidentes, acidentes, doenças ocupacionais ou outros eventos. A equipe de segurança será notificada."
    >
      <OcorrenciaForm lookups={{ empresas: empresas ?? [], unidades: unidades ?? [] }} />
    </PublicFormShell>
  );
}
```

- [ ] **Step 3: Type-check + build + commit**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

```bash
git add components/forms/ocorrencia-form.tsx app/(public)/forms/ocorrencias/page.tsx
git commit -m "feat(phase-5): multi-step public ocorrência form (Identificação → Detalhes → Anexos)"
```

---

# Section F — Wrap up

### Task 18: Happy-path E2E selector audit + Phase 5 spec status

The happy-path E2E uses selectors that may have shifted after the restyle (`input[name='colaborador_nome']`, `select[name='tipo_id']`, `li:has-text(...)`, `button name=Aprovar/Rejeitar`). Audit, update where needed, run the suite, then mark Phase 5 complete in the parent spec.

**Files:**
- Modify (if needed): `tests/e2e/happy-path.spec.ts`
- Modify: `docs/superpowers/specs/2026-05-14-frontend-redesign-design.md`

- [ ] **Step 1: Run the full vitest suite to catch unit-test regressions**

Run: `npx vitest run`
Expected: all tests pass (existing + 3 new files from this phase).

- [ ] **Step 2: Type-check + production build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 3: Audit `tests/e2e/happy-path.spec.ts` against the new markup**

Open `tests/e2e/happy-path.spec.ts`. For each selector, confirm it still resolves in the new UI:

| Old selector | After Phase 5 |
|---|---|
| `input[placeholder='CPF (11 dígitos)']` | Still works — `CpfLookup` keeps that placeholder |
| `getByRole("button", { name: "Buscar" })` | Still works |
| `input[name='colaborador_nome']` | Still works — `Input {...form.register("colaborador_nome")}` emits `name` attr |
| `select[name='tipo_id']` | **Broken** — replaced by shadcn `<Select>` (no `<select>` element). Update to set via combobox interaction or directly via `form.setValue` workaround — use a Playwright `selectOption` equivalent for the new combobox or click the trigger + option |
| `input[name='data_inicio']` | Still works |
| `input[name='email_remetente']` | Still works |
| `getByRole("button", { name: "Enviar" })` | Still works |
| `getByText("Enviado.")` | Still works |
| login flow + `/painel` redirect | Unchanged (Phase 4) |
| `li:has-text('e2e@example.com')` on `/aprovacoes` | **Likely shifted** — list items now show the email in a meta line within the card. Replace with `getByRole("link", { name: /e2e@example.com/i })` or a card-level locator. The card's "Ver detalhes" link is the new entrypoint — clicking it goes to `/afastamentos/[id]`, where Aprovar lives |
| `getByRole("button", { name: "Aprovar" })` | Still works (now in `<ApprovalBar>`) |
| `getByText("Aprovado.")` | Still works |

Apply the two updates (tipo selector + approval flow target). Patch:

```ts
// Replace this block:
await page.locator("select[name='tipo_id']").selectOption({ label: "Doença" });

// With:
await page.getByLabel("Tipo de afastamento").click();
await page.getByRole("option", { name: "Doença" }).click();
```

```ts
// Replace this block (after login):
await page.goto("/afastamentos/aprovacoes");
await page.locator("li:has-text('e2e@example.com')").first().click();
await page.getByRole("button", { name: "Aprovar" }).click();

// With:
await page.goto("/afastamentos/aprovacoes");
await page.getByRole("link", { name: /Ver detalhes/i }).first().click();
await expect(page).toHaveURL(/\/afastamentos\/[\w-]+/);
await page.getByRole("button", { name: "Aprovar" }).click();
```

- [ ] **Step 4: Smoke-test the dev server manually (best effort, document if blocked)**

Run: `npm run dev` (background) — visit each new page route in the browser if the env supports it, otherwise rely on the production build + visual inspection in the next ultrareview. List of routes to spot-check:

```
/                                  (public landing — unchanged)
/login                             (Phase 3 — unchanged)
/painel                            (Phase 4 — unchanged)
/afastamentos                      (Task 8)
/afastamentos/aprovacoes           (Task 9)
/afastamentos/<id>                 (Task 11)
/ocorrencias                       (Task 10)
/ocorrencias/<id>                  (Task 12)
/ocorrencias/<id>/investigacao     (Task 13)
/admin                             (Task 14)
/admin/empresas                    (Task 14)
/admin/unidades                    (Task 14)
/admin/afastamento-tipos           (Task 14)
/admin/usuarios                    (Task 15)
/admin/equipes                     (Task 15)
/admin/configuracoes               (Task 15)
/forms/afastamentos                (Task 16)
/forms/ocorrencias                 (Task 17)
/afastamentos/editar/<token>       (Task 16, only when an `rejeitado` record exists)
```

- [ ] **Step 5: Mark Phase 5 complete in the parent spec**

In `docs/superpowers/specs/2026-05-14-frontend-redesign-design.md`, find the `### Phase 5 — Operational pages` heading. Add the status line directly beneath it:

```markdown
### Phase 5 — Operational pages
**Status:** ✅ Complete (commit range: <FIRST_COMMIT_SHA>..<LAST_COMMIT_SHA>)

Every remaining page reaches the design quality bar.
```

Capture the commit range with: `git log --oneline --reverse | grep "phase-5" | head -1` (first SHA) and `git log --oneline -1` (last SHA).

- [ ] **Step 6: Commit the final updates**

```bash
git add tests/e2e/happy-path.spec.ts docs/superpowers/specs/2026-05-14-frontend-redesign-design.md
git commit -m "chore(phase-5): update happy-path E2E for new combobox + approval flow; mark Phase 5 done"
```

---

## Self-review checklist

**Spec coverage (§7–§10 of parent spec):**
- ✅ `data-table`, `filter-rail`, `status-pill`, `empty-state` — Tasks 1–3
- ✅ `detail-header`, `field-grid`, `attachment-chip`, `approval-bar`, `stepper`, `timeline-events` rewrite — Tasks 4–7
- ✅ `/afastamentos`, `/afastamentos/aprovacoes`, `/ocorrencias` list pages — Tasks 8–10
- ✅ `/afastamentos/[id]`, `/ocorrencias/[id]`, `/ocorrencias/[id]/investigacao` detail pages — Tasks 11–13
- ✅ `CrudTable` refactor + 6 admin routes restyle — Tasks 14, 15
- ✅ Public forms (afastamentos, ocorrencias, edit-token) — Tasks 16, 17
- ✅ Happy-path E2E still passes + Phase 5 spec status — Task 18

**Public landing E2E:** Already exists at `tests/e2e/public-landing.spec.ts` (Phase 2 deliverable). No new file required.

**Radius rule:** All new components use `rounded-md` or smaller. No new `rounded-full` on rectangles. No new `rounded-xl` introduced; existing painel cards stay.

**Type consistency:** `EventoType`/`TipoEntidade`/`EventoTone` imports from existing `lib/eventos.ts` + `lib/eventos-format.ts`. `StatusDomain`/`StatusTone`/`StatusPillSpec` are new types in `lib/status-pill.ts`. `OcorrenciaSituacao` from `lib/ocorrencia-state.ts`. `DataTableColumn<Row>` is generic. `Field` in `field-grid.tsx`. `BreadcrumbItem` in `detail-header.tsx`. `StepperStep` in `stepper.tsx`. `PendenteRow`/`AfastamentoFull`/`OcorrenciaFull` are exported from their respective domain modules and re-used at page level.

**Schema accuracy:** Plan uses the real Supabase column names from the codebase (`tipo_entidade`/`entidade_id`/`ocorrido_em`/`autor_id` on eventos; `colaborador_nome`/`situacao`/`afastamento_tipos!inner(rotulo)` on afastamentos; `tipo`/`empresas!inner(nome)`/`investigacoes(id, situacao, dados)` on ocorrencias). The four real afastamento situações (`pendente`/`rejeitado`/`finalizado`/`cancelado`) drive the filter chips; legacy "aprovado/em_andamento/rascunho" values from the spec table are noted as documentation drift, not implemented.

**API parity:** Existing `/api/public/afastamentos`, `/api/public/ocorrencias`, `/api/afastamentos/[id]/aprovar`, `/api/afastamentos/[id]/rejeitar`, `/api/ocorrencias/[id]/investigacao`, and `/api/admin/*` routes are untouched. Pages keep their query shapes and just render through the new components.

---

## Risks & mitigations

- **shadcn `<Select>` ↔ `react-hook-form`:** The new forms use controlled `Select` via `form.watch` + `form.setValue` instead of `register`. zod resolver still validates because the underlying form state is set. If hidden inputs become necessary for some browser quirk, fall back to a `Controller` wrapper around `<Select>` — not preferred but available. The E2E test update in Task 18 already handles the locator shift.
- **`ApprovalBar` only renders when current user is OH/admin:** Detail page does an extra Supabase round-trip (`userCanApprove`). For non-approvers, the bar is hidden — happy-path E2E uses an OH user so this should be fine.
- **`TimelineEvents` is now server-rendered:** Pages own the supabase query and pass `rows` as props. The old client-side fetch via `/api/eventos/...` is no longer used by these pages. The API route stays available for any future client-side use; it is not deleted.
- **`/admin/equipes` Select-to-add UX:** shadcn `<Select>` doesn't reset its display after `onValueChange` fires. If the placeholder doesn't reappear after adding a member, accept the minor UX wart — it doesn't block the workflow. Optional polish: track a `key` state and bump it after each successful add to remount the Select.
- **Delete button in `<AdminCrudTable>`:** Surfaces an error toast if the resource has no DELETE route. That's an existing gap and out of scope here; the button stays so consumers can wire DELETE incrementally.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-14-frontend-redesign-phase-5-operational-pages.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, two-stage review (spec compliance → code quality) after each, fast iteration in this session.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
