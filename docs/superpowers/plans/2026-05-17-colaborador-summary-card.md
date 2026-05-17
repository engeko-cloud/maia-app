# ColaboradorSummaryCard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live-fetched worker summary card above the afastamentos list in `portal/painel`, showing nome, cargo, setor, unidade, and matrícula from SOC with fallback to the most recent afastamento's denormalized fields.

**Architecture:** `ColaboradorSummaryCard` is an async server component wrapped in `<Suspense>` in the painel page. A pure `resolveColaboradorData` helper (in `lib/`) picks SOC data over fallback — this is the only unit-testable logic. The component calls `fetchSocColaborador` directly (server-only), renders the divided-columns layout, and is never shown when the worker has no afastamentos.

**Tech Stack:** Next.js (async server components, Suspense streaming), Vitest (unit tests), Tailwind CSS, `lib/soc.ts` (`fetchSocColaborador`, `SocColaborador`)

---

## Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `lib/colaborador-summary.ts` | Pure data resolution: SOC → fallback merge |
| Create | `tests/unit/colaborador-summary.test.ts` | Unit tests for resolution logic |
| Create | `components/painel/colaborador-summary-card.tsx` | Async server component + skeleton export |
| Modify | `app/(portal)/portal/painel/page.tsx` | Query update + Suspense wiring |

---

## Task 1: Pure data resolution helper

**Files:**
- Create: `lib/colaborador-summary.ts`
- Create: `tests/unit/colaborador-summary.test.ts`

This logic needs to be unit-testable, so extract it from the component into a pure function.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/colaborador-summary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveColaboradorData } from "@/lib/colaborador-summary";

const FALLBACK = {
  nome: "João Fallback",
  cargo: "Analista",
  setor: "TI",
  unidade_nome: "Hospital A",
};

describe("resolveColaboradorData", () => {
  it("uses SOC data when available", () => {
    const soc = {
      cpf: "12345678901",
      nome: "João SOC",
      cargo: "Enfermeiro",
      setor: "UTI",
      codigo_soc: "00123",
      unidade_nome: "Hospital Central",
      unidade_codigo: "HC1",
    };
    const result = resolveColaboradorData(soc, FALLBACK);
    expect(result.nome).toBe("João SOC");
    expect(result.cargo).toBe("Enfermeiro");
    expect(result.setor).toBe("UTI");
    expect(result.unidade_nome).toBe("Hospital Central");
    expect(result.codigo_soc).toBe("00123");
  });

  it("falls back to fallback data when soc is null", () => {
    const result = resolveColaboradorData(null, FALLBACK);
    expect(result.nome).toBe("João Fallback");
    expect(result.cargo).toBe("Analista");
    expect(result.setor).toBe("TI");
    expect(result.unidade_nome).toBe("Hospital A");
    expect(result.codigo_soc).toBeNull();
  });

  it("omits codigo_soc when soc has no codigo_soc", () => {
    const soc = {
      cpf: "12345678901",
      nome: "João SOC",
    };
    const result = resolveColaboradorData(soc, FALLBACK);
    expect(result.codigo_soc).toBeNull();
  });

  it("falls back individual fields from fallback when soc fields are missing", () => {
    const soc = {
      cpf: "12345678901",
      nome: "João SOC",
      // cargo, setor, unidade_nome all missing
    };
    const result = resolveColaboradorData(soc, FALLBACK);
    expect(result.nome).toBe("João SOC");
    expect(result.cargo).toBe("Analista");
    expect(result.setor).toBe("TI");
    expect(result.unidade_nome).toBe("Hospital A");
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/unit/colaborador-summary.test.ts
```

Expected: error — `Cannot find module '@/lib/colaborador-summary'`

- [ ] **Step 3: Create the helper**

Create `lib/colaborador-summary.ts`:

```ts
import type { SocColaborador } from "@/lib/soc";

export type ColaboradorDisplayData = {
  nome: string;
  cargo: string | null;
  setor: string | null;
  unidade_nome: string | null;
  codigo_soc: string | null;
};

export type ColaboradorFallback = {
  nome: string | null;
  cargo: string | null;
  setor: string | null;
  unidade_nome: string | null;
};

export function resolveColaboradorData(
  soc: Pick<SocColaborador, "nome" | "cargo" | "setor" | "unidade_nome" | "codigo_soc"> | null,
  fallback: ColaboradorFallback,
): ColaboradorDisplayData {
  return {
    nome: soc?.nome ?? fallback.nome ?? "",
    cargo: soc?.cargo ?? fallback.cargo ?? null,
    setor: soc?.setor ?? fallback.setor ?? null,
    unidade_nome: soc?.unidade_nome ?? fallback.unidade_nome ?? null,
    codigo_soc: soc?.codigo_soc ?? null,
  };
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/unit/colaborador-summary.test.ts
```

Expected: all 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/colaborador-summary.ts tests/unit/colaborador-summary.test.ts
git commit -m "feat(painel): add colaborador data resolution helper"
```

---

## Task 2: ColaboradorSummaryCard component

**Files:**
- Create: `components/painel/colaborador-summary-card.tsx`

- [ ] **Step 1: Create the component**

Create `components/painel/colaborador-summary-card.tsx`:

```tsx
import { fetchSocColaborador } from "@/lib/soc";
import { resolveColaboradorData, type ColaboradorFallback } from "@/lib/colaborador-summary";

type Props = {
  cpf: string;
  empresaCodigoSoc: string;
  fallback: ColaboradorFallback;
};

export async function ColaboradorSummaryCard({ cpf, empresaCodigoSoc, fallback }: Props) {
  let soc = null;
  try {
    soc = await fetchSocColaborador(empresaCodigoSoc, cpf);
  } catch {
    // SOC unavailable — use fallback silently
  }

  const data = resolveColaboradorData(soc, fallback);

  const cols: { label: string; value: string | null }[] = [
    { label: "Colaborador", value: data.nome },
    { label: "Cargo", value: data.cargo },
    { label: "Setor", value: data.setor },
    { label: "Unidade", value: data.unidade_nome },
    ...(data.codigo_soc ? [{ label: "Matrícula", value: data.codigo_soc }] : []),
  ];

  return (
    <div className="flex divide-x divide-[var(--color-border)] rounded-md border border-[var(--color-border)] bg-white">
      {cols.map((col, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col gap-1 px-5 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            {col.label}
          </span>
          <span
            className={`truncate text-sm font-medium text-[var(--color-fg)] ${i === 0 ? "text-base font-semibold" : ""}`}
          >
            {col.value ?? "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ColaboradorSummaryCardSkeleton() {
  return (
    <div className="flex divide-x divide-[var(--color-border)] rounded-md border border-[var(--color-border)] bg-white">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col gap-2 px-5 py-3">
          <div className="h-2.5 w-12 animate-pulse rounded bg-[var(--color-border)]" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--color-border)]" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to the new file

- [ ] **Step 3: Commit**

```bash
git add components/painel/colaborador-summary-card.tsx
git commit -m "feat(painel): add ColaboradorSummaryCard async server component"
```

---

## Task 3: Wire up in painel page

**Files:**
- Modify: `app/(portal)/portal/painel/page.tsx`

The page needs to:
1. Expand the afastamentos query to include `empresa_id`, `colaborador_cargo`, `colaborador_setor`, `empresas!inner(nome, codigo_soc)`, and `unidades!inner(nome)`
2. Update the `AfastamentoRow` type to match
3. Render `<ColaboradorSummaryCard>` inside `<Suspense>` above the KPI grid

- [ ] **Step 1: Update `AfastamentoRow` type and query**

Replace the `AfastamentoRow` type and the afastamentos query in `app/(portal)/portal/painel/page.tsx`.

Current type (lines 11–20):
```ts
type AfastamentoRow = {
  id: string;
  situacao: string;
  data_inicio: string;
  data_fim: string | null;
  duracao: number | null;
  colaborador_nome: string | null;
  afastamento_tipos: { rotulo: string };
  empresas: { nome: string };
};
```

Replace with:
```ts
type AfastamentoRow = {
  id: string;
  situacao: string;
  data_inicio: string;
  data_fim: string | null;
  duracao: number | null;
  colaborador_nome: string | null;
  colaborador_cargo: string | null;
  colaborador_setor: string | null;
  empresa_id: string;
  afastamento_tipos: { rotulo: string };
  empresas: { nome: string; codigo_soc: string | null };
  unidades: { nome: string } | null;
};
```

Current query select string (line 49):
```ts
"id, situacao, data_inicio, data_fim, duracao, colaborador_nome, afastamento_tipos!inner(rotulo), empresas!inner(nome)"
```

Replace with:
```ts
"id, situacao, data_inicio, data_fim, duracao, colaborador_nome, colaborador_cargo, colaborador_setor, empresa_id, afastamento_tipos!inner(rotulo), empresas!inner(nome, codigo_soc), unidades(nome)"
```

Note: `unidades` uses a plain join (not `!inner`) so afastamentos without a linked unidade still appear.

- [ ] **Step 2: Add import and render the card**

Add these imports near the top of the file (with the other component imports):

```ts
import { Suspense } from "react";
import {
  ColaboradorSummaryCard,
  ColaboradorSummaryCardSkeleton,
} from "@/components/painel/colaborador-summary-card";
```

In the JSX, add the card **above** the `{total > 0 && (...)}` KPI grid block. The full updated return becomes:

```tsx
return (
  <div className="flex flex-col gap-6">
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{saudacao}</h1>
      {banner && <p className="text-sm text-[var(--color-fg-muted)]">{banner}</p>}
    </header>
    {rows && rows.length > 0 && rows[0].empresas.codigo_soc && (
      <Suspense fallback={<ColaboradorSummaryCardSkeleton />}>
        <ColaboradorSummaryCard
          cpf={session.cpf}
          empresaCodigoSoc={rows[0].empresas.codigo_soc}
          fallback={{
            nome: rows[0].colaborador_nome,
            cargo: rows[0].colaborador_cargo,
            setor: rows[0].colaborador_setor,
            unidade_nome: rows[0].unidades?.nome ?? null,
          }}
        />
      </Suspense>
    )}
    {total > 0 && (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Total de afastamentos"
          value={total}
        />
        <KpiCard
          label="Último afastamento"
          value={`${fmtDate(last!.data_inicio)} → ${fmtDate(last!.data_fim!)}`}
        />
        <KpiCard
          label="Status atual"
          value={isAfastado ? "Afastado" : "Sem afastamento ativo"}
          delta={isAfastado ? (() => {
            const [y, m, d] = (activeAfastamento!.data_fim! as string).split("-").map(Number);
            const next = new Date(y, m - 1, d + 1);
            const ry = next.getFullYear();
            const rm = String(next.getMonth() + 1).padStart(2, "0");
            const rd = String(next.getDate()).padStart(2, "0");
            return `Retorno em ${rm}/${rd}/${ry}`;
          })() : undefined}
          tone={isAfastado ? "warning" : "primary"}
        />
      </div>
    )}
    <DataTable
      rows={rows ?? []}
      columns={COLUMNS}
      getRowId={(r) => r.id}
      getRowHref={(r) => `/portal/afastamentos/${r.id}`}
      empty={<EmptyState icon={FileText} title={textoVazio} />}
    />
  </div>
);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Run full unit test suite**

```bash
npx vitest run
```

Expected: all tests pass (no regressions)

- [ ] **Step 5: Commit**

```bash
git add app/\(portal\)/portal/painel/page.tsx
git commit -m "feat(painel): render ColaboradorSummaryCard above afastamentos list"
```

---

## Self-Review

**Spec coverage:**
- ✅ Card appears above afastamentos list in portal/painel
- ✅ Live SOC fetch using cpf + empresa codigo_soc
- ✅ Fallback to last afastamento denormalized fields on SOC failure/null
- ✅ Fields: nome, cargo, setor, unidade, matrícula (hidden when null)
- ✅ Divided-columns layout (option B)
- ✅ Skeleton while streaming
- ✅ Card not shown when no afastamentos
- ✅ Not shown on app/afastamentos/[id] (out of scope, not touched)

**Placeholder scan:** None found.

**Type consistency:** `ColaboradorFallback` defined in Task 1, used in Task 2 props and Task 3 — consistent. `ColaboradorSummaryCard` props match what Task 3 passes.
