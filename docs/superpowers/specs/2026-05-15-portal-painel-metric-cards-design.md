# Portal Painel — Metric Cards

**Date:** 2026-05-15

## Goal

Add three metric cards above the afastamentos table on `/portal/painel` so staff can see at a glance their history count, most recent afastamento, and current absence status.

## Cards

### Card 1 — Total de afastamentos
- **Value:** count of all afastamentos for the logged-in CPF
- **Delta:** none

### Card 2 — Último afastamento
- **Value:** `DD/MM/YYYY → DD/MM/YYYY` (data_inicio → data_fim of the most recent row by criado_em)
- **Delta:** none
- **Empty state:** hidden (no rows = no cards rendered at all)

### Card 3 — Status atual
- **Value:** `Afastado` or `Sem afastamento ativo`
- **Determination:** find the most recent approved afastamento where `data_fim > now`; if found → Afastado; else → Sem afastamento ativo
- **Delta when Afastado:** `Retorno em DD/MM/YYYY` (data_fim + 1 calendar day)
- **Tone:** `warning` (amber) when Afastado; `primary` (default) when not

## Data

No additional query needed. The page already fetches all rows for the CPF ordered by `criado_em desc`. All three cards are computed from that result set.

## Component Changes

`KpiCard` gains a `warning` tone option (amber bottom strip). The existing `primary` and `accent` tones are unchanged.

## Layout

```
grid grid-cols-1 gap-3 sm:grid-cols-3
```

Cards are rendered only when `rows.length > 0`. The grid sits between the header and the DataTable.

## Date Formatting

Reuse the existing `fmtDate` helper in the page file. For card 2 show date only (no time). For the return date on card 3 compute `new Date(data_fim)` + 1 day and format as `DD/MM/YYYY`.
