# Date Format Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all raw ISO date strings and pt-BR locale calls with a single shared `fmtDate`/`fmtDateTime` utility that outputs `MM/DD/YYYY` (and `MM/DD/YYYY HH:MM` for datetimes) across all UI pages, components, and CSV exports.

**Architecture:** Create `lib/fmt-date.ts` as the single source of truth for date display. All pages and components import from it. CSV mappers use it so exported spreadsheets are human-readable. The portal painel's three local helper functions are deleted and replaced with the shared utility.

**Tech Stack:** TypeScript, Vitest (tests at `tests/unit/`)

---

## File Map

| Action | Path | What changes |
|--------|------|-------------|
| Create | `lib/fmt-date.ts` | New shared utility |
| Create | `tests/unit/fmt-date.test.ts` | Unit tests for utility |
| Modify | `lib/relatorio/afastamentos-csv.ts` | fmtDate on data_inicio / data_fim |
| Modify | `lib/relatorio/ocorrencias-csv.ts` | fmtDate on data_ocorrencia |
| Modify | `tests/unit/afastamentos-csv.test.ts` | Update date assertions |
| Modify | `tests/unit/ocorrencias-csv.test.ts` | Update date assertion |
| Modify | `app/app/afastamentos/page.tsx` | fmtDate in column render |
| Modify | `components/afastamentos/afastamento-detail.tsx` | fmtDate in field values |
| Modify | `components/afastamentos/aprovacoes-panel.tsx` | fmtDate in render |
| Modify | `app/app/ocorrencias/page.tsx` | Replace toLocaleDateString |
| Modify | `app/app/ocorrencias/[id]/page.tsx` | Replace toLocaleString |
| Modify | `app/app/ocorrencias/[id]/investigacao/page.tsx` | Replace toLocaleString |
| Modify | `components/ocorrencias/ocorrencia-detail-card.tsx` | Replace toLocaleString |
| Modify | `app/app/investigacoes/page.tsx` | Replace toLocaleDateString |
| Modify | `components/investigacoes/investigacao-report.tsx` | Replace toLocaleString |
| Modify | `app/(portal)/portal/painel/page.tsx` | Delete local helpers; import fmtDateTime |
| Modify | `app/(portal)/portal/afastamentos/[id]/page.tsx` | fmtDate in field values |
| Modify | `app/(public)/afastamentos/status/[token]/page.tsx` | fmtDate in Período row |
| Modify | `app/(public)/ocorrencias/status/[token]/page.tsx` | fmtDateTime in Data row |

---

## Task 1: Create shared date utility (TDD)

**Files:**
- Create: `tests/unit/fmt-date.test.ts`
- Create: `lib/fmt-date.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/fmt-date.test.ts
import { describe, it, expect } from "vitest";
import { fmtDate, fmtDateTime } from "@/lib/fmt-date";

describe("fmtDate", () => {
  it("converts YYYY-MM-DD to MM/DD/YYYY", () => {
    expect(fmtDate("2024-01-15")).toBe("01/15/2024");
  });
  it("strips time part when present", () => {
    expect(fmtDate("2024-03-07T14:30:00")).toBe("03/07/2024");
  });
  it("pads single-digit month and day", () => {
    expect(fmtDate("2024-03-05")).toBe("03/05/2024");
  });
});

describe("fmtDateTime", () => {
  it("formats ISO datetime to MM/DD/YYYY HH:MM", () => {
    expect(fmtDateTime("2024-01-15T09:30:00")).toBe("01/15/2024 09:30");
  });
  it("uses fallbackTime for date-only strings", () => {
    expect(fmtDateTime("2024-01-15", "00:00")).toBe("01/15/2024 00:00");
  });
  it("defaults fallbackTime to 00:00 if omitted", () => {
    expect(fmtDateTime("2024-01-15")).toBe("01/15/2024 00:00");
  });
});
```

- [ ] **Step 2: Run to confirm they fail**

```bash
npx vitest run tests/unit/fmt-date.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the utility**

```typescript
// lib/fmt-date.ts
function split(iso: string): { y: string; m: string; d: string; time: string } {
  const [datePart, timePart = ""] = iso.includes("T") ? iso.split("T") : [iso, ""];
  const [y, m, d] = datePart.split("-");
  return { y, m, d, time: timePart.slice(0, 5) };
}

export function fmtDate(iso: string): string {
  const { y, m, d } = split(iso);
  return `${m}/${d}/${y}`;
}

export function fmtDateTime(iso: string, fallbackTime = "00:00"): string {
  const { y, m, d, time } = split(iso);
  return `${m}/${d}/${y} ${time || fallbackTime}`;
}
```

- [ ] **Step 4: Run to confirm they pass**

```bash
npx vitest run tests/unit/fmt-date.test.ts
```
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/fmt-date.ts tests/unit/fmt-date.test.ts
git commit -m "feat: add fmtDate/fmtDateTime shared utility for MM/DD/YYYY display"
```

---

## Task 2: Update CSV export mappers

**Files:**
- Modify: `lib/relatorio/afastamentos-csv.ts`
- Modify: `lib/relatorio/ocorrencias-csv.ts`
- Modify: `tests/unit/afastamentos-csv.test.ts`
- Modify: `tests/unit/ocorrencias-csv.test.ts`

- [ ] **Step 1: Update afastamentos CSV test expectations first**

In `tests/unit/afastamentos-csv.test.ts`, change lines 38–39:

```typescript
// before
expect(row[8]).toBe("2024-01-15");   // data_inicio
expect(row[9]).toBe("2024-01-20");   // data_fim
// after
expect(row[8]).toBe("01/15/2024");   // data_inicio
expect(row[9]).toBe("01/20/2024");   // data_fim
```

- [ ] **Step 2: Update ocorrencias CSV test expectation**

In `tests/unit/ocorrencias-csv.test.ts`, change line 39:

```typescript
// before
expect(row[8]).toBe("2024-03-10");   // data_ocorrencia
// after
expect(row[8]).toBe("03/10/2024");   // data_ocorrencia
```

- [ ] **Step 3: Run CSV tests to confirm they now fail**

```bash
npx vitest run tests/unit/afastamentos-csv.test.ts tests/unit/ocorrencias-csv.test.ts
```
Expected: FAIL on the date assertions.

- [ ] **Step 4: Update afastamentos-csv.ts**

Add the import and change the date fields in `lib/relatorio/afastamentos-csv.ts`:

```typescript
// add at top
import { fmtDate } from "@/lib/fmt-date";

// in toAfastamentoCsvRows, change lines 49–50 from:
    r.data_inicio,
    r.data_fim ?? "",
// to:
    fmtDate(r.data_inicio),
    r.data_fim ? fmtDate(r.data_fim) : "",
```

- [ ] **Step 5: Update ocorrencias-csv.ts**

```typescript
// add at top
import { fmtDate } from "@/lib/fmt-date";

// in toOcorrenciaCsvRows, change line 51 from:
    r.data_ocorrencia,
// to:
    fmtDate(r.data_ocorrencia),
```

- [ ] **Step 6: Run CSV tests to confirm they pass**

```bash
npx vitest run tests/unit/afastamentos-csv.test.ts tests/unit/ocorrencias-csv.test.ts
```
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add lib/relatorio/afastamentos-csv.ts lib/relatorio/ocorrencias-csv.ts \
        tests/unit/afastamentos-csv.test.ts tests/unit/ocorrencias-csv.test.ts
git commit -m "feat(csv): format dates as MM/DD/YYYY in export reports"
```

---

## Task 3: Update afastamentos admin UI

**Files:**
- Modify: `app/app/afastamentos/page.tsx`
- Modify: `components/afastamentos/afastamento-detail.tsx`
- Modify: `components/afastamentos/aprovacoes-panel.tsx`

- [ ] **Step 1: Update afastamentos list page**

In `app/app/afastamentos/page.tsx`, add import and update column render (~line 73):

```typescript
// add import near top with other lib imports
import { fmtDate } from "@/lib/fmt-date";

// change the "periodo" column render from:
render: (r) => `${r.data_inicio} → ${r.data_fim ?? "—"}`,
// to:
render: (r) => `${fmtDate(r.data_inicio)} → ${r.data_fim ? fmtDate(r.data_fim) : "—"}`,
```

- [ ] **Step 2: Update AfastamentoDetail component**

In `components/afastamentos/afastamento-detail.tsx`, add import and change lines 41–42:

```typescript
// add import
import { fmtDate } from "@/lib/fmt-date";

// change the two date fields from:
    { label: "Início",             value: a.data_inicio, mono: true },
    { label: "Fim",                value: a.data_fim ?? "—", mono: true },
// to:
    { label: "Início",             value: fmtDate(a.data_inicio), mono: true },
    { label: "Fim",                value: a.data_fim ? fmtDate(a.data_fim) : "—", mono: true },
```

- [ ] **Step 3: Update aprovacoes panel**

In `components/afastamentos/aprovacoes-panel.tsx`, add import and change line 53:

```typescript
// add import
import { fmtDate } from "@/lib/fmt-date";

// change the date part of the info line from:
                  {p.afastamento_tipos?.rotulo ?? "—"} · {p.data_inicio}
                  {p.data_fim ? ` → ${p.data_fim}` : ""}
// to:
                  {p.afastamento_tipos?.rotulo ?? "—"} · {fmtDate(p.data_inicio)}
                  {p.data_fim ? ` → ${fmtDate(p.data_fim)}` : ""}
```

- [ ] **Step 4: Run full test suite to make sure nothing broke**

```bash
npx vitest run
```
Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/app/afastamentos/page.tsx \
        components/afastamentos/afastamento-detail.tsx \
        components/afastamentos/aprovacoes-panel.tsx
git commit -m "feat(ui): format afastamento dates as MM/DD/YYYY in admin views"
```

---

## Task 4: Update ocorrencias + investigacoes admin UI

**Files:**
- Modify: `app/app/ocorrencias/page.tsx`
- Modify: `app/app/ocorrencias/[id]/page.tsx`
- Modify: `app/app/ocorrencias/[id]/investigacao/page.tsx`
- Modify: `components/ocorrencias/ocorrencia-detail-card.tsx`
- Modify: `app/app/investigacoes/page.tsx`
- Modify: `components/investigacoes/investigacao-report.tsx`

- [ ] **Step 1: Update ocorrencias list page**

In `app/app/ocorrencias/page.tsx`, ~line 55:

```typescript
// add import
import { fmtDate } from "@/lib/fmt-date";

// change column render from:
new Date(r.data_ocorrencia).toLocaleDateString("pt-BR")
// to:
fmtDate(r.data_ocorrencia)
```

- [ ] **Step 2: Update ocorrencia detail page**

In `app/app/ocorrencias/[id]/page.tsx`, ~line 60:

```typescript
// add import
import { fmtDateTime } from "@/lib/fmt-date";

// change from:
new Date(row.data_ocorrencia).toLocaleString("pt-BR")
// to:
fmtDateTime(row.data_ocorrencia)
```

- [ ] **Step 3: Update ocorrencia+investigacao sub-detail page**

In `app/app/ocorrencias/[id]/investigacao/page.tsx`, ~line 84:

```typescript
// add import
import { fmtDateTime } from "@/lib/fmt-date";

// change from:
new Date(row.data_ocorrencia).toLocaleString("pt-BR")
// to:
fmtDateTime(row.data_ocorrencia)
```

- [ ] **Step 4: Update ocorrencia detail card component**

In `components/ocorrencias/ocorrencia-detail-card.tsx`, ~line 21:

```typescript
// add import
import { fmtDateTime } from "@/lib/fmt-date";

// change from:
new Date(o.data_ocorrencia).toLocaleString("pt-BR")
// to:
fmtDateTime(o.data_ocorrencia)
```

- [ ] **Step 5: Update investigacoes list page**

In `app/app/investigacoes/page.tsx`, ~line 51:

```typescript
// add import
import { fmtDate } from "@/lib/fmt-date";

// change from:
new Date(r.ocorrencias.data_ocorrencia).toLocaleDateString("pt-BR")
// to:
fmtDate(r.ocorrencias.data_ocorrencia)
```

- [ ] **Step 6: Update investigacao report component**

In `components/investigacoes/investigacao-report.tsx`, ~line 71:

```typescript
// add import
import { fmtDateTime } from "@/lib/fmt-date";

// change from:
new Date(ocorrencia.data_ocorrencia).toLocaleString("pt-BR")
// to:
fmtDateTime(ocorrencia.data_ocorrencia)
```

- [ ] **Step 7: Run tests**

```bash
npx vitest run
```
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add app/app/ocorrencias/page.tsx \
        "app/app/ocorrencias/[id]/page.tsx" \
        "app/app/ocorrencias/[id]/investigacao/page.tsx" \
        components/ocorrencias/ocorrencia-detail-card.tsx \
        app/app/investigacoes/page.tsx \
        components/investigacoes/investigacao-report.tsx
git commit -m "feat(ui): format ocorrencia/investigacao dates as MM/DD/YYYY"
```

---

## Task 5: Update portal pages

**Files:**
- Modify: `app/(portal)/portal/painel/page.tsx`
- Modify: `app/(portal)/portal/afastamentos/[id]/page.tsx`

- [ ] **Step 1: Update portal painel — replace local helpers**

In `app/(portal)/portal/painel/page.tsx`:

Remove the three local helper functions (`fmtDate`, `fmtDateOnly`, `nextDayFmt` at lines 21–42) entirely.

Add import at top:

```typescript
import { fmtDateTime } from "@/lib/fmt-date";
```

Update the two column renders (lines 46–47) from:

```typescript
  { key: "inicio",   label: "Início",   render: (r) => fmtDate(r.data_inicio, "00:00"), mono: true },
  { key: "fim",      label: "Fim",      render: (r) => r.data_fim ? fmtDate(r.data_fim, "23:59") : "—", mono: true },
```
to:
```typescript
  { key: "inicio",   label: "Início",   render: (r) => fmtDateTime(r.data_inicio, "00:00"), mono: true },
  { key: "fim",      label: "Fim",      render: (r) => r.data_fim ? fmtDateTime(r.data_fim, "23:59") : "—", mono: true },
```

If `nextDayFmt` was called anywhere else in the file, replace those calls with the appropriate `fmtDate`/`fmtDateTime` call and delete the helper. If it's genuinely unused after removing calls, just delete the function.

- [ ] **Step 2: Update portal afastamento detail**

In `app/(portal)/portal/afastamentos/[id]/page.tsx`, ~lines 47–48:

```typescript
// add import
import { fmtDate } from "@/lib/fmt-date";

// change from:
    { label: "Início",   value: row.data_inicio, mono: true },
    { label: "Fim",      value: row.data_fim ?? "—", mono: true },
// to:
    { label: "Início",   value: fmtDate(row.data_inicio), mono: true },
    { label: "Fim",      value: row.data_fim ? fmtDate(row.data_fim) : "—", mono: true },
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add "app/(portal)/portal/painel/page.tsx" \
        "app/(portal)/portal/afastamentos/[id]/page.tsx"
git commit -m "feat(portal): use shared fmtDate/fmtDateTime, remove local date helpers"
```

---

## Task 6: Update public status pages

**Files:**
- Modify: `app/(public)/afastamentos/status/[token]/page.tsx`
- Modify: `app/(public)/ocorrencias/status/[token]/page.tsx`

- [ ] **Step 1: Update public afastamento status page**

In `app/(public)/afastamentos/status/[token]/page.tsx`, ~line 64:

```typescript
// add import
import { fmtDate } from "@/lib/fmt-date";

// change the Período dd row from:
        <dd>{a.data_inicio} → {a.data_fim ?? "—"} {a.duracao ? `(${a.duracao} dia${a.duracao > 1 ? "s" : ""})` : ""}</dd>
// to:
        <dd>{fmtDate(a.data_inicio)} → {a.data_fim ? fmtDate(a.data_fim) : "—"} {a.duracao ? `(${a.duracao} dia${a.duracao > 1 ? "s" : ""})` : ""}</dd>
```

- [ ] **Step 2: Update public ocorrencia status page**

In `app/(public)/ocorrencias/status/[token]/page.tsx`, line 57:

```typescript
// add import
import { fmtDateTime } from "@/lib/fmt-date";

// change from:
        <dd>{new Date(o.data_ocorrencia).toLocaleString("pt-BR")}</dd>
// to:
        <dd>{fmtDateTime(o.data_ocorrencia)}</dd>
```

- [ ] **Step 3: Run full test suite one final time**

```bash
npx vitest run
```
Expected: all pass with no regressions.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/afastamentos/status/[token]/page.tsx" \
        "app/(public)/ocorrencias/status/[token]/page.tsx"
git commit -m "feat(public): format dates as MM/DD/YYYY on public status pages"
```

---

## Self-Review

**Spec coverage:**
- ✅ Afastamentos list → Task 3
- ✅ Aprovacoes list → Task 3 (aprovacoes-panel.tsx)
- ✅ Afastamentos details (admin + portal + public) → Tasks 3, 5, 6
- ✅ Ocorrencias (list, detail, investigacao) → Task 4
- ✅ Investigacoes list → Task 4
- ✅ CSV export reports (afastamentos + ocorrencias) → Task 2
- ✅ Shared utility to avoid future drift → Task 1

**Placeholder scan:** No TBDs, TODOs, or "similar to Task N" shortcuts. Every step shows exact code.

**Type consistency:** `fmtDate(iso: string): string` and `fmtDateTime(iso: string, fallbackTime?: string): string` used identically across all tasks.
