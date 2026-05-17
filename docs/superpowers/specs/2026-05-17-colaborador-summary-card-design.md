# ColaboradorSummaryCard — Design Spec

**Date:** 2026-05-17
**Scope:** portal/painel page only

---

## Overview

Add a `ColaboradorSummaryCard` above the afastamentos list in `portal/painel`. The card shows the worker's current data from SOC (nome, cargo, setor, unidade, matrícula), fetched live on page load. If SOC is unavailable, it falls back silently to denormalized fields on the worker's most recent afastamento record.

---

## Data

**Source:** Live SOC fetch via `lookupSocColaborador(empresaId, cpf)` from `lib/soc.ts`.

**Inputs:**
- `cpf` — from `requirePortalSession()` session
- `empresaId` — from `rows[0].empresa_id` (first/most recent afastamento); requires adding `empresa_id` to the afastamentos select in the painel page

**Fallback fields** (from `rows[0]` when SOC fails or returns null):
- `colaborador_nome`
- `colaborador_cargo`
- `colaborador_setor`
- Unidade name: requires adding `unidades!inner(nome)` to the afastamentos select in the painel page; omit the column if unavailable

**Fields displayed:**
| Column | SOC field | Fallback field |
|---|---|---|
| Nome | `nome` | `colaborador_nome` |
| Cargo | `cargo` | `colaborador_cargo` |
| Setor | `setor` | `colaborador_setor` |
| Unidade | `unidade_nome` | `unidades.nome` (join added to painel query) |
| Matrícula | `codigo_soc` | hidden if null |

---

## Layout

Divided-columns style (option B): each field in its own labelled column with vertical dividers. Matches the structured, scannable pattern used in `AfastamentoDetail`.

```
┌──────────────────────────────────────────────────────────┐
│  Nome             │ Cargo          │ Setor   │ Unidade   │ Matrícula │
│  Maria da Silva   │ Técnica Enf.   │ UTI     │ H. Central│ 004521    │
└──────────────────────────────────────────────────────────┘
```

Matrícula column is omitted entirely if `codigo_soc` is null.

---

## Component Structure

### New file: `components/painel/colaborador-summary-card.tsx`

- `async` server component (no `"use client"`)
- Calls `lookupSocColaborador` inside a try/catch; on any error uses fallback props
- Exports two things:
  - `ColaboradorSummaryCard` — the async default export
  - `ColaboradorSummaryCardSkeleton` — a named export matching the card's height/column structure, used as Suspense fallback

### Edit: `app/(portal)/portal/painel/page.tsx`

- Add `empresa_id` to the afastamentos `.select(...)` string
- Import `ColaboradorSummaryCard` and `ColaboradorSummaryCardSkeleton`
- Render above the KPI grid, only when `rows.length > 0`:

```tsx
{rows.length > 0 && (
  <Suspense fallback={<ColaboradorSummaryCardSkeleton />}>
    <ColaboradorSummaryCard
      cpf={session.cpf}
      empresaId={rows[0].empresa_id}
      fallback={{
        colaborador_nome: rows[0].colaborador_nome,
        colaborador_cargo: rows[0].colaborador_cargo,
        colaborador_setor: rows[0].colaborador_setor,
        unidade_nome: rows[0].unidades?.nome ?? null,
      }}
    />
  </Suspense>
)}
```

---

## Render States

| State | Behaviour |
|---|---|
| SOC success | Renders with live SOC data |
| SOC failure / null | Renders with fallback data from `rows[0]`; no error UI |
| No afastamentos | Card not rendered; painel shows empty state as today |

No "refresh" button. No staleness indicator. The worker does not need to know the data source.

---

## Out of Scope

- App route `app/afastamentos/[id]` — afastamento detail already shows all worker fields
- Any caching or persistence of SOC data
- A "last updated" timestamp on the card
