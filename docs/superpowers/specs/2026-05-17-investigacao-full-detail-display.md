# Investigação Full Detail Display — Design Spec
_Date: 2026-05-17_

## Scope

Three related gaps found after deploy:

1. Admin ocorrência detail shows a button for `em_andamento` investigations instead of the full investigation data.
2. Investigações list shows all statuses — it should be a work queue (active only).
3. Public ocorrência status page shows no investigation data at all.

**Business rule confirmed:** Every ocorrência auto-creates an investigação at submission time (`situacao = 'em_andamento'`). The concept of "Iniciar investigação" is incorrect and must be removed.

---

## Files created / modified

| File | Change |
|---|---|
| `components/investigacoes/investigacao-data-view.tsx` | **New** — shared read-only display of all investigação data |
| `components/investigacoes/investigacao-detail-section.tsx` | **New** — admin detail section: full data + status-specific action bar |
| `components/investigacoes/investigation-status.tsx` | **Delete** — replaced by investigacao-detail-section |
| `components/investigacoes/investigacao-summary.tsx` | **Delete** — becomes unused |
| `app/app/ocorrencias/[id]/page.tsx` | Add categorias/graus queries; swap `InvestigationStatus` → `InvestigacaoDetailSection` |
| `app/(public)/ocorrencias/status/[token]/page.tsx` | Add investigação + categorias/graus queries; render `InvestigacaoDataView` + conditional edit link |
| `app/app/investigacoes/page.tsx` | Add `.in("situacao", [...])` filter |

---

## 1. `InvestigacaoDataView` (new shared component)

**Path:** `components/investigacoes/investigacao-data-view.tsx`

**Purpose:** Read-only display of investigação dados. Used in both admin detail page and public status page. Modeled directly on the existing `InvestigacaoReport` sections 4–7 but adapted for the detail-page card style (not print layout).

**Props:**
```ts
interface InvestigacaoDataViewProps {
  dados: InvestigacaoDados;
  categoriasById: Record<string, { rotulo: string; codigo: string }>;
  grausById: Record<string, { rotulo: string }>;
  storagePublicBase: string; // `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/attachments/`
}
```

**Sections rendered:**

| Section | Empty state |
|---|---|
| Análise Ishikawa — 2-col grid of branch cards (category label, grau badge, causa list) | "Nenhuma causa registrada." |
| Plano de ação — table: Ação / Responsável / Prazo / Status | "Nenhum item no plano de ação." |
| Participantes — list: nome + email | "Nenhum participante." |
| Fotos — 2-col image grid with captions | "Nenhuma foto." |

Ishikawa branches with zero causas are skipped (same as report).

Fotos: render `<img src={storagePublicBase + foto.path} alt={foto.legenda ?? ""} />` inside a `figure`.

Each section is a `<section>` with an `<h3>` header styled consistently with existing detail cards (e.g., `text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]`).

---

## 2. `InvestigacaoDetailSection` (new admin component)

**Path:** `components/investigacoes/investigacao-detail-section.tsx`

**Purpose:** Replaces `InvestigationStatus` on the admin ocorrência detail page. Always renders full investigation data via `InvestigacaoDataView`, plus a status-specific action bar.

**Props:**
```ts
interface InvestigacaoDetailSectionProps {
  ocorrenciaId: string;
  investigacao: {
    situacao: "em_andamento" | "em_aprovacao" | "aprovada" | "rejeitada" | "cancelada";
    dados: InvestigacaoDados;
    token_publico: string;
    motivo_rejeicao: string | null;
  };
  categoriasById: Record<string, { rotulo: string; codigo: string }>;
  grausById: Record<string, { rotulo: string }>;
  storagePublicBase: string;
}
```

Note: `investigacao` is **never null** here — the page always has one (auto-created at submission).

**Action bar per situacao:**

| situacao | Action bar |
|---|---|
| `em_andamento` | `<Link href={/app/ocorrencias/${id}/investigacao}><Button>Abrir investigação</Button></Link>` |
| `em_aprovacao` | "Aguardando aprovação." + `<Button>Revisar agora</Button>` → admin investigação page + `<Button variant="secondary">Ver relatório</Button>` → public report |
| `rejeitada` | Red callout with `motivo_rejeicao` text + `<Button>Ajustar investigação</Button>` → admin investigação page |
| `aprovada` | `<Button variant="secondary">Ver relatório</Button>` → public report |
| `cancelada` | Muted note: "Investigação cancelada." |

Public report URL: `/ocorrencias/relatorio/${token_publico}`
Admin investigação URL: `/app/ocorrencias/${ocorrenciaId}/investigacao`

**Structure:**
```
<section class="rounded-md border bg-white p-6 flex flex-col gap-6">
  <header>
    <h2>Investigação</h2>
    <StatusPill domain="investigacao" situacao={investigacao.situacao} />
  </header>
  <InvestigacaoDataView ... />
  <div class="border-t pt-4 flex gap-2">
    [action bar buttons]
  </div>
</section>
```

---

## 3. Admin ocorrência detail page changes

**Path:** `app/app/ocorrencias/[id]/page.tsx`

**Additional queries** (in `Promise.all`):
```ts
supabase.from("investigacao_categorias").select("id, codigo, rotulo").eq("ativo", true),
supabase.from("investigacao_graus").select("id, rotulo").eq("ativo", true),
```

Build lookup maps:
```ts
const categoriasById = Object.fromEntries((categoriasData ?? []).map((c) => [c.id, { rotulo: c.rotulo, codigo: c.codigo }]));
const grausById = Object.fromEntries((grausData ?? []).map((g) => [g.id, { rotulo: g.rotulo }]));
const storagePublicBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/attachments/`;
```

Replace `<InvestigationStatus ... />` with:
```tsx
{row.investigacoes?.[0] && (
  <InvestigacaoDetailSection
    ocorrenciaId={row.id}
    investigacao={row.investigacoes[0]}
    categoriasById={categoriasById}
    grausById={grausById}
    storagePublicBase={storagePublicBase}
  />
)}
```

Remove `import { InvestigationStatus }`, add imports for new components.

---

## 4. Public status page changes

**Path:** `app/(public)/ocorrencias/status/[token]/page.tsx`

**Additional query** (after existing ocorrência fetch):
```ts
const { data: inv } = await supabase
  .from("investigacoes")
  .select("id, situacao, dados, token_publico, motivo_rejeicao")
  .eq("ocorrencia_id", o.id)  // need to select `id` from ocorrência first, see note below
  .single();

const [{ data: categorias }, { data: graus }] = await Promise.all([
  supabase.from("investigacao_categorias").select("id, codigo, rotulo").eq("ativo", true),
  supabase.from("investigacao_graus").select("id, rotulo").eq("ativo", true),
]);
```

Note: the current query selects `serial_id, situacao, tipo, ...` but not `id`. Add `id` to the ocorrência select so the investigação query can join on it.

Build maps same as admin page.

**Render below the `<dl>` field grid:**
```tsx
{inv && (
  <>
    <div class="mt-6 border-t pt-6">
      <InvestigacaoDataView
        dados={inv.dados}
        categoriasById={categoriasById}
        grausById={grausById}
        storagePublicBase={storagePublicBase}
      />
    </div>
    {(inv.situacao === "em_andamento" || inv.situacao === "rejeitada") && (
      <a href={`/investigacoes/editar/${inv.token_publico}`} class="...">
        Editar investigação →
      </a>
    )}
  </>
)}
```

---

## 5. Investigações list filter

**Path:** `app/app/investigacoes/page.tsx`

Add to query:
```ts
.in("situacao", ["em_andamento", "em_aprovacao", "rejeitada"])
```

Update subtitle:
```tsx
{rows.length} investigaç{rows.length === 1 ? "ão" : "ões"} em aberto
```

---

## 6. Delete dead code

Once `InvestigacaoDetailSection` replaces `InvestigationStatus` in the admin page:

- Delete `components/investigacoes/investigation-status.tsx`
- Delete `components/investigacoes/investigacao-summary.tsx` (only consumed by `investigation-status.tsx`)

Verify no other imports before deleting:
```bash
grep -rn "InvestigationStatus\|InvestigacaoSummary" --include="*.tsx" --include="*.ts" src/ app/ components/ | grep -v node_modules
```

---

## Data flow summary

```
Admin detail page
  ├── fetch: ocorrencia + investigacao.dados
  ├── fetch: investigacao_categorias (ativo=true)
  ├── fetch: investigacao_graus (ativo=true)
  └── InvestigacaoDetailSection
        └── InvestigacaoDataView (shared)

Public status page
  ├── fetch: ocorrencia (by token_edicao)
  ├── fetch: investigacoes (by ocorrencia_id)
  ├── fetch: investigacao_categorias + investigacao_graus
  └── InvestigacaoDataView (shared)
        + conditional edit link

Investigações list
  └── query filtered to em_andamento | em_aprovacao | rejeitada
```

---

## Out of scope

- The public investigação edit form (`/investigacoes/editar/[token]`) already shows all data in read-only mode for closed investigations — no change needed.
- No DB schema changes.
- No changes to the report/print route.
