# AfastamentoHistoryCard + CID Columns — Design Spec

**Date:** 2026-05-17
**Scope:** App afastamento detail page, app afastamentos list, portal painel list

---

## Overview

Three related enhancements to the afastamentos flows:

1. **`AfastamentoHistoryCard`** — a new component on the app-side afastamento detail page (`app/app/afastamentos/[id]`) showing the worker's 60-day afastamento history with a duracao sum and a direct export shortcut.
2. **CID column in app list** — add CID to the afastamentos list in `app/app/afastamentos/page.tsx`.
3. **CID column in portal list** — add CID to the afastamentos list in `app/(portal)/portal/painel/page.tsx`.

---

## 1. AfastamentoHistoryCard

### Placement

Rendered on `app/app/afastamentos/[id]/page.tsx`, between the conditional `<ApprovalBar>` and the two-column grid (`AfastamentoDetail` + timeline). Wrapped in `<Suspense>` with a skeleton fallback.

### Data

Async server component. Props: `{ cpf: string; currentId: string }`.

Query `afastamentos` with Supabase admin:
- `cpf = props.cpf`
- `situacao != 'rejeitado'` (includes `pendente` and `aprovado`)
- `data_inicio >= (today - 60 days)` — computed server-side as `new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10)`
- `ORDER BY data_inicio DESC` (most recent first)

Fields selected: `id, data_inicio, data_fim, duracao, cid, situacao`

The current afastamento is included in the results (its `data_inicio` falls within the window). `id` is fetched only to identify the current row — never shown in the UI.

### Layout

```
┌─ Histórico 60 dias ──────────────────── [↓ Exportar histórico] ─┐
│ Início       Fim          Duração   CID    Situação              │
│ 14/04/2026   ─            3 dias    J00    Pendente  ← current   │
│ 01/04/2026   05/04/2026   5 dias    J00    Aprovado              │
│─────────────────────────────────────────────────────────────────│
│ Total                     8 dias                                │
└─────────────────────────────────────────────────────────────────┘
```

- Columns: Início | Fim | Duração | CID | Situação
- `id` column never shown
- Current row highlighted with `bg-[var(--color-bg-subtle)]` or equivalent subtle background
- `situacao` rendered as `<StatusPill domain="afastamento" situacao={r.situacao} />`
- Footer row: "Total" label + sum of all `duracao` values in the window (null-safe, treat null as 0) + em-dash for other columns
- If `data_fim` is null, render "—"
- If `cid` is null, render "—"

### ExportHistoryButton

Small client component. Props: `{ cpf: string }`.

On click, POSTs directly to `/api/relatorios/afastamentos` with body `{ cpf }` (no empresa/unidade/dates — full history for this worker). No dialog. Inline state transitions:

- Idle: `<button>` with download icon + "Exportar histórico"
- Loading: button disabled, spinner or "Gerando…" text
- Done: inline "Relatório enviado para o seu e-mail." (stays; no auto-reset)
- Error: inline "Erro ao gerar relatório." in red

### Skeleton

`AfastamentoHistoryCardSkeleton` — matches card height with animated pulse rows (4 rows × 5 columns).

---

## 2. CID Column — App List (`app/app/afastamentos/page.tsx`)

- Add `cid` to the `.select(...)` string
- Add `cid: string | null` to the `AfastamentoRow` type
- Add a CID column to `COLUMNS`: `{ key: "cid", label: "CID", render: (r) => r.cid ?? "—", mono: true }`

---

## 3. CID Column — Portal List (`app/(portal)/portal/painel/page.tsx`)

- Add `cid` to the `.select(...)` string
- Add `cid: string | null` to `AfastamentoRow`
- Add a CID column to `COLUMNS`: `{ key: "cid", label: "CID", render: (r) => r.cid ?? "—", mono: true }`

---

## Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `components/afastamentos/afastamento-history-card.tsx` | Async server component + skeleton export |
| Create | `components/afastamentos/export-history-button.tsx` | Client component — direct CPF export |
| Modify | `app/app/afastamentos/[id]/page.tsx` | Add Suspense + AfastamentoHistoryCard between ApprovalBar and grid |
| Modify | `app/app/afastamentos/page.tsx` | Add `cid` to query + COLUMNS |
| Modify | `app/(portal)/portal/painel/page.tsx` | Add `cid` to query + COLUMNS |

---

## Render States

| State | Behaviour |
|---|---|
| History loaded, has records | Card renders with list + sum |
| History loaded, only current record | Card renders with single highlighted row + sum |
| History loading | Skeleton shown via Suspense fallback |
| Export idle | Button shows download icon + label |
| Export in flight | Button disabled, loading text |
| Export success | Inline success message |
| Export error | Inline error message in red |

---

## Out of Scope

- Showing history card in portal route
- Date range filter on the history card itself (use export for that)
- Caching or background refresh of history data
