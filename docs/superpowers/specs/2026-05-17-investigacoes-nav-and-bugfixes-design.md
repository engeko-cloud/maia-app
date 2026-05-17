# Investigações Nav + Bug Fixes — Design Spec
_Date: 2026-05-17_

## Scope

Four concern areas identified from post-deploy manual testing:

1. Admin-route links missing `/app/` prefix in components (broke in Task 1 rename)
2. "Iniciar investigação" shown for an already-open investigação
3. Investigações nav/painel pointing to `/app/ocorrencias` — needs its own list route
4. Realtime notification crash in admin layout (React Strict Mode double-mount)

No DB schema changes required.

---

## 1. Broken Admin Links

Several client components were written before the `(app)` → `app/` rename and were not caught by the Task 2 find-and-replace because they use template literals, not string literals.

### Files to fix

| File | Broken href | Correct href |
|---|---|---|
| `components/investigacoes/investigation-status.tsx` (×3) | `` `/ocorrencias/${id}/investigacao` `` | `` `/app/ocorrencias/${id}/investigacao` `` |
| `components/investigacoes/investigacao-summary.tsx` (×1) | `` `/ocorrencias/${ocorrenciaId}/investigacao` `` | `` `/app/ocorrencias/${ocorrenciaId}/investigacao` `` |
| `components/afastamentos/aprovacoes-panel.tsx` (×1) | `` `/afastamentos/${p.id}` `` | `` `/app/afastamentos/${p.id}` `` |
| `components/saude/saude-client.tsx` (×1) | `` `/afastamentos/${item.id}` `` | `` `/app/afastamentos/${item.id}` `` |

**Not changed:** `/ocorrencias/relatorio/${token}` links in `investigation-status.tsx` and `decision-action-bar.tsx` — that is a public route (`app/(public)/`) and is correct.

---

## 2. "Iniciar" vs "Continuar" Logic Fix

`components/investigacoes/investigation-status.tsx` line 107 gates the button label on whether `dados` is empty:

```ts
// Before
isEmpty ? "Iniciar investigação" : "Continuar investigação"
```

When an investigação record exists in `em_andamento` but has no dados yet, `isEmpty = true` → button wrongly says "Iniciar". The investigação already exists — starting it twice is incorrect.

Fix: gate on whether the investigação record exists, not on data emptiness:

```ts
// After
investigacao === null ? "Iniciar investigação" : "Continuar investigação"
```

`isEmpty` remains used for the descriptive text above the button (the "Ainda não iniciada" vs "em andamento" paragraph), which is correct as-is.

---

## 3. Investigações Dedicated List Route

### Route

New page: `app/app/investigacoes/page.tsx`

- Guard: `requireEquipe("safety")` at top
- Breadcrumb: Painel / Investigações
- Title: "Investigações"
- Subtitle: count of rows

### Data query

```ts
supabase
  .from("investigacoes")
  .select("id, situacao, ocorrencias!inner(id, tipo, data_ocorrencia, empresas!inner(nome))")
  .order("criado_em", { ascending: false })
  .limit(200)
```

Filter by `situacao` when provided via `searchParams`.

### Table columns

| Column | Value |
|---|---|
| Tipo | `ocorrenciaTipoLabel(row.ocorrencias.tipo)` |
| Empresa | `row.ocorrencias.empresas.nome` |
| Data ocorrência | `row.ocorrencias.data_ocorrencia` formatted pt-BR |
| Situação | `<StatusPill domain="investigacao" situacao={row.situacao} />` |

**Row click** → `/app/ocorrencias/${row.ocorrencias.id}` (same pair pattern as Aprovações → Afastamento detail)

### StatusPill for investigação

`components/data/status-pill.tsx` already accepts a `domain` prop. Check if `"investigacao"` domain is handled; if not, add the color mappings:

| situacao | tone |
|---|---|
| em_andamento | `"neutral"` |
| em_aprovacao | `"warning"` |
| aprovada | `"success"` |
| rejeitada | `"danger"` |
| cancelada | `"muted"` |

### Nav + Painel updates

`lib/nav.ts` — Investigações sub-item under Ocorrências:
```ts
{ label: "Investigações", href: "/app/investigacoes" }
```
(was: `"/app/ocorrencias"`)

`app/app/painel/page.tsx` — Investigações QuickAction:
```tsx
<QuickAction href="/app/investigacoes" ... />
```
(was: `"/app/ocorrencias"`)

---

## 4. Realtime Notification Crash

### Root cause

`hooks/use-notifications.ts` calls `supabase.channel("notifications")`. The Supabase browser client is a singleton. In React Strict Mode (Next.js dev), effects fire twice: on the second mount, `supabase.channel("notifications")` returns the same channel instance that is already subscribed from the first mount (before cleanup fully completes). Calling `.on()` on a subscribed channel throws:

> `cannot add postgres_changes callbacks for realtime:notifications after subscribe()`

### Fix

Use a unique channel name per mount so a fresh channel is always created:

```ts
// hooks/use-notifications.ts — realtime useEffect
const channelName = React.useRef(`notifications-${Math.random().toString(36).slice(2)}`);

React.useEffect(() => {
  const supabase = getSupabaseBrowser();
  const channel = supabase
    .channel(channelName.current)
    .on("postgres_changes", { ... }, handler)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, []);
```

`Math.random().toString(36).slice(2)` produces a 10-char alphanumeric suffix — collision risk is negligible. The `useRef` ensures the name is stable across re-renders within the same mount (not regenerated on every render), but a fresh name is used after remount.

---

## Implementation notes

- No maia-db changes needed.
- `StatusPill` domain extension is additive — check existing implementation before assuming it needs changes.
- The Investigações list does **not** need a dedicated client component — the page can be a server component with a `DataTable` (same as `ocorrencias/page.tsx`).
- Row navigation in `DataTable` uses `getRowHref` prop — confirm the prop name by reading `components/data/data-table.tsx`.
