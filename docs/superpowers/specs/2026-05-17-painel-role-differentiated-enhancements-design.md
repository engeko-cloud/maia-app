# Painel Role-Differentiated Enhancements

**Date:** 2026-05-17  
**Scope:** `app/app/painel/page.tsx`, `components/painel/painel-hero.tsx`, `components/painel/quick-action.tsx`, `components/painel/kpi-card.tsx`

---

## Overview

Three enhancements to the admin painel to better differentiate the experience per role (admin / oh / safety) and introduce consistent color semantics (orange = action needed, blue = all clear).

---

## 1 · Hero Card — Role-Differentiated

### Problem
`isInEquipe` returns `true` for admins unconditionally, so the existing hero logic (`showOh && pendentes > 0` first) always resolves to OH content for admins even when safety content is also relevant.

### Solution
Add an explicit `isAdmin(me)` check in the page to branch the hero logic into three paths.

**OH-only:**
- Headline: "X aprovações aguardando sua revisão."
- CTA: Ver aprovações → `/app/afastamentos/aprovacoes`

**Safety-only:**
- Headline: "X investigações aguardando conclusão."  
- CTA: Ver investigações → `/app/investigacoes`

**Admin (both):**
- Headline when both > 0: "X aprovações e Y investigações aguardando revisão."
- Headline when only pendentes > 0: "X aprovações aguardando sua revisão."
- Headline when only investigacoesPendentes > 0: "Y investigações aguardando conclusão."
- Headline when neither > 0: "Nada pendente — tudo em dia."
- CTAs: show "Ver aprovações" when `pendentes > 0`, show "Ver investigações" when `investigacoesPendentes > 0`, show both when both > 0.

**All clear (any role):** "Nada pendente — tudo em dia." with no CTA.

### Component change: `PainelHero`
Replace the single `cta?: { href: string; label: string }` prop with `ctas?: { href: string; label: string }[]`. When two CTAs are provided they render side-by-side (flex-row, gap). Single CTA renders as today.

---

## 2 · Quick Action Card Colors

### Rule
All quick action cards default to **blue** (`tone="primary"`). Orange (`tone="accent"`) applies only when an actionable count badge is present and > 0.

| Card | Tone logic |
|---|---|
| Aprovações | `pendentes > 0 ? "accent" : "primary"` |
| Ocorrências | `ocorrenciasAbertas > 0 ? "accent" : "primary"` |
| Afastamentos | always `"primary"` |
| Investigações | always `"primary"` |
| Nova ocorrência | always `"primary"` |
| Novo afastamento | always `"primary"` |

The count badge pill stays orange unconditionally (it only renders when count > 0).

---

## 3 · KPI Cards — New Metrics + Dynamic Tone

### New metrics

**Ocorrências no mês** (replaces "Ocorrências abertas"):  
Count of `ocorrencias` where `criado_em >= first day of current calendar month`. Reflects volume, not status — gives a sense of monthly activity regardless of investigation state.

**Investigações pendentes** (new):  
Count of `investigacoes` where `situacao IN ('em_andamento', 'em_aprovacao')`. Excludes `rejeitada`. This count is also consumed by the admin hero, so it is fetched once and shared.

### Dynamic tone
`tone={value > 0 ? "accent" : "primary"}` on every KPI card.  
- Orange (`accent`) = there is something that needs attention  
- Blue (`primary`) = all clear

### Visibility by role

| KPI | OH | Safety | Admin |
|---|---|---|---|
| Afastamentos ativos | ✓ | — | ✓ |
| Aprovações pendentes | ✓ | — | ✓ |
| Ocorrências no mês | — | ✓ | ✓ |
| Investigações pendentes | — | ✓ | ✓ |

Admin sees all four in a 2×2 grid (existing `grid-cols-2` already handles this).

### Data fetch changes
Both safety KPI queries are guarded by `showSafety` (which is true for admins). The `ocorrenciasAbertas` query used for quick-action card count is separate from the new "no mês" KPI — `ocorrenciasAbertas` (status = `aberta`) remains for the Ocorrências quick-action badge count.

```
ocorrencias_mes  = count WHERE criado_em >= startOfMonth(now)   [showSafety]
investigacoes_pendentes = count WHERE situacao IN ('em_andamento','em_aprovacao')  [showSafety]
```

The existing `ocorrenciasAbertas` query (`situacao = 'aberta'`) is **kept** — used only for the quick-action count badge on the Ocorrências card. It is no longer used for any KPI.

---

## Affected Files

| File | Change |
|---|---|
| `components/painel/painel-hero.tsx` | Replace `cta` prop with `ctas` array |
| `components/painel/quick-action.tsx` | No structural change — tone is passed from page |
| `components/painel/kpi-card.tsx` | No structural change — tone is passed from page |
| `app/app/painel/page.tsx` | Add `isAdmin`, new queries, updated hero/KPI/quick-action props |
