# Afastamentos — serial_id, Approval Inline Edit, Active Page

**Date:** 2026-05-17
**Scope:** App afastamentos list, portal painel list, app afastamento detail, approval bar, new active afastamentos page

---

## Overview

Three enhancements to the afastamentos system:

1. **serial_id prominence** — surface `serial_id` as the primary human-readable identifier in all afastamento lists and detail pages.
2. **Approval inline edit** — allow OH team members to correct key fields (tipo, unidade, data_inicio, duracao, cid, emissor) directly from the approval bar before approving, without rejecting and re-requesting.
3. **Active afastamentos page** — a new page at `/app/afastamentos/ativos` showing all currently active afastamentos (non-rejected, non-pending, data_fim ≥ today) with KPIs and tipo filtering.

---

## 1. serial_id Prominence

### Lists

Add `serial_id: number | null` to `AfastamentoRow` in:
- `app/app/afastamentos/page.tsx`
- `app/(portal)/portal/painel/page.tsx`

Add `serial_id` to each page's `.select()` string.

Add a `#` column as the **first column** in both `COLUMNS` arrays:

```ts
{ key: "id", label: "#", render: (r) => r.serial_id != null ? `#${r.serial_id}` : "—", mono: true },
```

### Detail pages

**App detail page** (`app/app/afastamentos/[id]/page.tsx`):

- Add `serial_id` to the `.select()` string.
- Update `titleSuffix` on `<DetailHeader>`:

```tsx
titleSuffix={`${row.serial_id != null ? `#${row.serial_id} · ` : ""}${row.cpf}`}
```

**Portal detail page** (`app/(portal)/portal/afastamentos/[id]/page.tsx`):

- Add `serial_id: number | null` to the `DetailRow` type and to the `.select()` string.
- Add `serial_id` as the first entry in the `fields` array passed to `FieldGrid`:

```ts
{ label: "#", value: row.serial_id != null ? `#${row.serial_id}` : "—", mono: true },
```

---

## 2. Approval Inline Edit

### New file: `components/afastamentos/afastamento-edit-dialog.tsx`

`"use client"` component. Props:

```ts
interface AfastamentoEditDialogProps {
  afastamentoId: string;
  tipos: { id: string; rotulo: string }[];
  unidades: { id: string; nome: string }[];
  initialValues: {
    tipo_id: string;
    unidade_id: string | null;
    data_inicio: string;           // YYYY-MM-DD
    duracao: number | null;
    cid: string | null;
    emissor: { tipo: string; no: string; uf: string } | null;
  };
}
```

Renders a `<Dialog>` trigger button labelled "Editar dados" with a pencil icon.

**Dialog body — fields:**

| Field | Input | Notes |
|-------|-------|-------|
| Tipo | `<select>` | Options from `tipos` prop (all `requer_aprovacao=true`, including inactive prev types) |
| Unidade | `<select>` | Options from `unidades` prop |
| Data início | `<input type="date">` | YYYY-MM-DD |
| Duração (dias) | `<input type="number" min="1">` | |
| Data fim | Read-only display | Calculated: `data_inicio + duracao − 1 day`, updates live as either field changes |
| CID | `<input type="text">` | |
| Emissor — Tipo | `<input type="text">` | e.g. CRM, CRO, COREN — free text, no fixed list |
| Emissor — Número | `<input type="text">` | |
| Emissor — UF | `<input type="text" maxLength={2}>` | uppercase |

**Data fim calculation** (pure function, used for display only — server recomputes):

```ts
function calcDataFim(dataInicio: string, duracao: number): string {
  const d = new Date(dataInicio + "T00:00:00");
  d.setDate(d.getDate() + duracao - 1);
  return d.toISOString().slice(0, 10);
}
```

**On save:**
1. POST to `PATCH /api/afastamentos/[id]/editar` with JSON body of all fields.
2. On success: close dialog, call `router.refresh()`, show toast "Dados atualizados."
3. On error: show toast with error message, keep dialog open.

States: idle → loading (button disabled) → success/error.

---

### Modified: `components/detail/approval-bar.tsx`

Add props:

```ts
interface ApprovalBarProps {
  afastamentoId: string;
  editProps: {
    tipos: { id: string; rotulo: string }[];
    unidades: { id: string; nome: string }[];
    initialValues: AfastamentoEditDialogProps["initialValues"];
  };
}
```

Render `<AfastamentoEditDialog>` as the leftmost button in the action group, before Rejeitar.

---

### Modified: `app/app/afastamentos/[id]/page.tsx`

When `showApprovalBar` is true, fetch additional data for the edit dialog:

```ts
const [{ data: rawRow }, { data: timelineData }, { data: tiposData }, { data: unidadesData }] = await Promise.all([
  supabase.from("afastamentos").select("..., unidade_id, tipo_id").eq("id", id).single(),
  supabase.from("eventos")...
  // only fetched when pendente — but Promise.all always runs; guard with conditional or fetch unconditionally
  supabase.from("afastamento_tipos").select("id, rotulo").eq("requer_aprovacao", true).order("ordem"),
  supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
]);
```

Fetch tipos and unidades unconditionally alongside the main query (they are small tables and cost is negligible). Pass to `<ApprovalBar>` as `editProps`.

Also add `unidade_id: string | null` and `tipo_id: string` to the `AfastamentoFull` interface.

---

### New file: `app/api/afastamentos/[id]/editar/route.ts`

**Method:** PATCH

**Auth:** Same check as `aprovar` — user must be admin or member of equipe "oh".

**Request body schema (Zod):**

```ts
const EditSchema = z.object({
  tipo_id:    z.string().uuid(),
  unidade_id: z.string().uuid().nullable(),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duracao:    z.number().int().positive(),
  cid:        z.string().nullable(),
  emissor:    z.object({
    tipo: z.string().min(1),
    no:   z.string().min(1),
    uf:   z.string().length(2),
  }).nullable(),
});
```

**Server-side data_fim computation:**

```ts
function computeDataFim(dataInicio: string, duracao: number): string {
  const d = new Date(dataInicio + "T00:00:00");
  d.setDate(d.getDate() + duracao - 1);
  return d.toISOString().slice(0, 10);
}
```

**Update fields:** `tipo_id`, `unidade_id`, `data_inicio`, `duracao`, `data_fim` (computed), `cid`, `emissor`.

**Audit event:** write evento `"editado"` with `dados: { campos: Object.keys(body) }`.

**Returns:** `{ ok: true }` on success, appropriate error responses on failure.

---

## 3. Active Afastamentos Page

### New file: `app/app/afastamentos/ativos/page.tsx`

Protected by `await requireEquipe("oh")`.

**searchParams:** `q` (search) and `status` (tipo codigo filter) — uses existing `parseFilterParams`.

**Query:**

```ts
const today = new Date().toISOString().slice(0, 10);
let query = supabase
  .from("afastamentos")
  .select("id, serial_id, cpf, colaborador_nome, data_inicio, data_fim, duracao, cid, situacao, afastamento_tipos!inner(codigo, rotulo)")
  .not("situacao", "in", '("rejeitado","pendente")')
  .gte("data_fim", today)
  .order("data_fim", { ascending: true });

if (tipoCodigo) query = query.eq("afastamento_tipos.codigo", tipoCodigo);
if (q) query = query.or(`colaborador_nome.ilike.%${safe}%,cpf.ilike.%${safe}%`);
```

Order: ascending by `data_fim` (soonest returning first — most actionable at top).

**KPIs (computed from query results, not separate DB queries):**

```ts
const total = rows.length;
const prev31 = rows.filter(r => r.afastamento_tipos.codigo === "prev_31").length;
const prev91 = rows.filter(r => r.afastamento_tipos.codigo === "prev_91").length;
const thisWeek = rows.filter(r => r.data_fim != null && r.data_fim <= sevenDaysFromNow).length;
```

Where `sevenDaysFromNow = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)`.

**KpiCard layout** (4 cards, same `KpiCard` component as portal painel):
- Total afastados
- Prev. 31 — Doença comum
- Prev. 91 — Acidente/ocupacional
- Retornam esta semana

**FilterRail chips:** Dynamically built from all active tipos (fetched alongside main query):

```ts
const chips: FilterChip[] = [
  { value: "", label: "Todos" },
  ...tipos.map(t => ({ value: t.codigo, label: t.rotulo })),
];
```

**Table columns** (`DataTableColumn<AtivoRow>[]`):

| Key | Label | Render |
|-----|-------|--------|
| `serial` | `#` | `r.serial_id != null ? \`#${r.serial_id}\` : "—"` mono |
| `colaborador` | Colaborador | nome + CPF (stacked, same pattern as other lists) |
| `tipo` | Tipo | `r.afastamento_tipos.rotulo` |
| `cid` | CID | `r.cid ?? "—"` mono |
| `inicio` | Início | `fmtDate(r.data_inicio)` mono |
| `fim` | Fim | `fmtDate(r.data_fim!)` mono |
| `dias` | Dias | `r.duracao != null ? \`${r.duracao} dias\` : "—"` |
| `situacao` | Situação | `<StatusPill domain="afastamento" situacao={r.situacao} />` |

**Row highlight:** `DataTable` `getRowClassName` prop (add if not yet supported, or wrap in a custom render) — rows where `data_fim <= sevenDaysFromNow` get `bg-[var(--color-bg-subtle)]`.

Each row links to `/app/afastamentos/${r.id}`.

### Modified: `lib/nav.ts`

Add "Ativos" to the afastamentos group:

```ts
items: [
  { label: "Lista",   href: "/app/afastamentos" },
  { label: "Ativos",  href: "/app/afastamentos/ativos" },
  { label: "Aprovações", href: "/app/afastamentos/aprovacoes" },
],
```

---

## Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `components/afastamentos/afastamento-edit-dialog.tsx` | Edit dialog client component |
| Create | `app/api/afastamentos/[id]/editar/route.ts` | PATCH endpoint — auth, validate, update, audit |
| Create | `app/app/afastamentos/ativos/page.tsx` | Active afastamentos page |
| Modify | `components/detail/approval-bar.tsx` | Add editProps + render AfastamentoEditDialog |
| Modify | `app/app/afastamentos/[id]/page.tsx` | Fetch tipos/unidades, pass editProps; add serial_id to query + header |
| Modify | `app/(portal)/portal/afastamentos/[id]/page.tsx` | Add serial_id to query + header |
| Modify | `app/app/afastamentos/page.tsx` | Add serial_id column |
| Modify | `app/(portal)/portal/painel/page.tsx` | Add serial_id column |
| Modify | `lib/nav.ts` | Add Ativos nav item |
| Modify | `components/afastamentos/afastamento-detail.tsx` | Add `serial_id` and `tipo_id`, `unidade_id` to `AfastamentoFull` interface |

---

## DataTable `getRowClassName`

The active page needs row highlighting. Check if `DataTable` already accepts a `getRowClassName` prop. If not, add it:

```ts
// In DataTable props
getRowClassName?: (row: T) => string | undefined;
```

Applied to the `<tr>` element as an additional class.

---

## Out of Scope

- Editing fields not listed (colaborador_nome, cpf, email_remetente, arquivo_url)
- Notifying the worker of inline edits
- Active afastamentos in the portal route
- Comments/notes system (separate spec)
