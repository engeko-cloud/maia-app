# Afastamentos — serial_id, Approval Edit, Active Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add serial_id as primary display identifier across all afastamento views, enable inline field correction during approval, and add an active afastamentos monitoring page with KPIs and tipo filtering.

**Architecture:** Eight tasks in dependency order — shared infrastructure first (EventoType, DataTable), then serial_id additions, then the pure date util + edit dialog + API route, then wiring the approval bar, then the active monitoring page. Each task is independently committable.

**Tech Stack:** Next.js app router, Supabase (RLS + admin client), React server + client components, Zod, Sonner toasts, lucide-react icons, base-ui primitives (Button, Dialog, Input, Label), Vitest for unit tests.

---

## Codebase Orientation

Key files and their roles:

| Path | Role |
|------|------|
| `lib/eventos.ts` | `writeEvento` helper + `EventoType` union |
| `lib/afastamento-state.ts` | State machine for situacao transitions |
| `components/data/data-table.tsx` | Generic `<DataTable>` used in all list pages |
| `components/detail/approval-bar.tsx` | Client component shown when situacao = "pendente" |
| `components/afastamentos/afastamento-detail.tsx` | Detail card + `AfastamentoFull` interface |
| `app/app/afastamentos/[id]/page.tsx` | App detail page — server component |
| `app/app/afastamentos/page.tsx` | App list page |
| `app/(portal)/portal/painel/page.tsx` | Portal list page |
| `app/(portal)/portal/afastamentos/[id]/page.tsx` | Portal detail page |
| `lib/nav.ts` | `appNav` array — drives the top nav dropdown |
| `lib/filter-rail.ts` | `parseFilterParams` (reads `q` + `status` from URL) |
| `components/painel/kpi-card.tsx` | `<KpiCard label value delta? tone?>` |

Auth pattern for app API routes: read `user` from `getSupabaseServer()`, check `usuarios.administrador` OR `equipe_usuarios` membership with `equipes.codigo = "oh"`.

Test runner: `npx vitest run tests/unit/<file>.test.ts`

---

## Task 1: Foundation — EventoType + DataTable getRowClassName

**Files:**
- Modify: `lib/eventos.ts`
- Modify: `components/data/data-table.tsx`

- [ ] **Step 1: Add "editado" to EventoType in `lib/eventos.ts`**

```ts
export type EventoType =
  | "criado" | "rejeitado" | "resubmetido" | "aprovado" | "editado"
  | "fluig_enviado" | "fluig_erro" | "email_enviado" | "cancelado"
  | "investigacao_iniciada" | "investigacao_finalizada"
  | "ocorrencia_para_safety_enviada" | "ocorrencia_para_safety_falhou";
```

- [ ] **Step 2: Add `getRowClassName` prop to DataTable**

In `components/data/data-table.tsx`, update `DataTableProps` and the `<TableRow>` render:

```ts
interface DataTableProps<Row> {
  rows: Row[];
  columns: DataTableColumn<Row>[];
  getRowId: (row: Row) => string;
  getRowHref?: (row: Row) => string;
  /** Optional extra className applied to each row. */
  getRowClassName?: (row: Row) => string | undefined;
  empty: React.ReactNode;
}
```

Update the component signature to destructure `getRowClassName`:

```ts
export function DataTable<Row>({
  rows, columns, getRowId, getRowHref, getRowClassName, empty,
}: DataTableProps<Row>) {
```

Update the `<TableRow>` inside the map:

```tsx
<TableRow
  key={id}
  className={cn("hover:bg-[var(--color-bg-subtle)]", getRowClassName?.(row))}
>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to changed files (pre-existing errors are unrelated).

- [ ] **Step 4: Commit**

```bash
git add lib/eventos.ts components/data/data-table.tsx
git commit -m "feat(afastamentos): add editado EventoType + DataTable getRowClassName"
```

---

## Task 2: serial_id in Afastamento Lists

**Files:**
- Modify: `app/app/afastamentos/page.tsx`
- Modify: `app/(portal)/portal/painel/page.tsx`

- [ ] **Step 1: Add serial_id to app list**

In `app/app/afastamentos/page.tsx`, add `serial_id` to the `AfastamentoRow` interface:

```ts
interface AfastamentoRow {
  id: string;
  serial_id: number | null;
  cpf: string;
  colaborador_nome: string;
  data_inicio: string;
  data_fim: string | null;
  situacao: string;
  cid: string | null;
  afastamento_tipos: { rotulo: string } | null;
}
```

Add `serial_id` to the `.select()` string (insert after `"id, `):

```ts
"id, serial_id, cpf, colaborador_nome, data_inicio, data_fim, situacao, cid, afastamento_tipos!inner(rotulo)"
```

Add `#` as the **first column** in the `columns` array, before the `colaborador` column:

```ts
const columns: DataTableColumn<AfastamentoRow>[] = [
  {
    key: "serial",
    label: "#",
    mono: true,
    render: (r) => r.serial_id != null ? `#${r.serial_id}` : "—",
  },
  // ... existing columns unchanged ...
];
```

- [ ] **Step 2: Add serial_id to portal list**

In `app/(portal)/portal/painel/page.tsx`, add `serial_id: number | null` to `AfastamentoRow`:

```ts
type AfastamentoRow = {
  id: string;
  serial_id: number | null;
  situacao: string;
  // ... rest unchanged
};
```

Add `serial_id` to the `.select()` string:

```ts
"id, serial_id, situacao, data_inicio, data_fim, duracao, colaborador_nome, colaborador_cargo, colaborador_setor, empresa_id, cid, afastamento_tipos!inner(rotulo), empresas!inner(nome, codigo_soc), unidades(nome)"
```

Add `#` as the first column in `COLUMNS`:

```ts
const COLUMNS: DataTableColumn<AfastamentoRow>[] = [
  { key: "serial", label: "#", mono: true, render: (r) => r.serial_id != null ? `#${r.serial_id}` : "—" },
  // ... existing columns unchanged ...
];
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add "app/app/afastamentos/page.tsx" "app/(portal)/portal/painel/page.tsx"
git commit -m "feat(afastamentos): add serial_id column to app and portal lists"
```

---

## Task 3: serial_id in Detail Pages + AfastamentoFull Interface

**Files:**
- Modify: `components/afastamentos/afastamento-detail.tsx`
- Modify: `app/app/afastamentos/[id]/page.tsx`
- Modify: `app/(portal)/portal/afastamentos/[id]/page.tsx`

- [ ] **Step 1: Extend AfastamentoFull interface**

In `components/afastamentos/afastamento-detail.tsx`, add three fields to `AfastamentoFull`:

```ts
export interface AfastamentoFull {
  id: string;
  serial_id: number | null;   // ← add
  tipo_id: string;            // ← add
  unidade_id: string | null;  // ← add
  cpf: string;
  colaborador_nome: string;
  // ... rest unchanged
}
```

`AfastamentoFull` is used to type-cast the Supabase `*` select result in the detail page. The DB columns `serial_id`, `tipo_id`, `unidade_id` are already present in `*`.

- [ ] **Step 2: Update app detail page**

In `app/app/afastamentos/[id]/page.tsx`:

The existing select already uses `*`, so `serial_id` is already fetched. Update `titleSuffix` in `<DetailHeader>`:

```tsx
titleSuffix={`${row.serial_id != null ? `#${row.serial_id} · ` : ""}${row.cpf}`}
```

- [ ] **Step 3: Update portal detail page**

In `app/(portal)/portal/afastamentos/[id]/page.tsx`, add `serial_id: number | null` to `DetailRow`:

```ts
type DetailRow = {
  id: string;
  serial_id: number | null;   // ← add
  situacao: string;
  cpf: string;
  // ... rest unchanged
};
```

Add `serial_id` to the `.select()` string:

```ts
"id, serial_id, situacao, cpf, data_inicio, data_fim, duracao, colaborador_nome, motivo_rejeicao, afastamento_tipos!inner(rotulo), empresas!inner(nome), unidades!inner(nome)"
```

Add `serial_id` as the **first entry** in `fields`:

```ts
const fields: Field[] = [
  { label: "#", value: row.serial_id != null ? `#${row.serial_id}` : "—", mono: true },
  { label: "Tipo",     value: row.afastamento_tipos.rotulo },
  // ... rest unchanged
];
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add components/afastamentos/afastamento-detail.tsx \
        "app/app/afastamentos/[id]/page.tsx" \
        "app/(portal)/portal/afastamentos/[id]/page.tsx"
git commit -m "feat(afastamentos): show serial_id in detail pages and extend AfastamentoFull"
```

---

## Task 4: Pure Date Utility + Unit Test

**Files:**
- Create: `lib/afastamento-date.ts`
- Create: `tests/unit/afastamento-date.test.ts`

This pure function is used by both the client dialog (live preview) and the server API route (canonical computation). Extracting it ensures they're identical.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/afastamento-date.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calcDataFim } from "@/lib/afastamento-date";

describe("calcDataFim", () => {
  it("returns same day when duracao is 1", () => {
    expect(calcDataFim("2026-05-01", 1)).toBe("2026-05-01");
  });

  it("adds duracao - 1 days to data_inicio", () => {
    expect(calcDataFim("2026-05-02", 18)).toBe("2026-05-19");
  });

  it("handles month boundary correctly", () => {
    expect(calcDataFim("2026-01-28", 5)).toBe("2026-02-01");
  });

  it("handles year boundary correctly", () => {
    expect(calcDataFim("2026-12-30", 4)).toBe("2027-01-02");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/unit/afastamento-date.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/afastamento-date'"

- [ ] **Step 3: Implement `lib/afastamento-date.ts`**

```ts
/** Returns data_fim as YYYY-MM-DD given data_inicio (YYYY-MM-DD) and duracao (days, ≥1). */
export function calcDataFim(dataInicio: string, duracao: number): string {
  const d = new Date(dataInicio + "T00:00:00");
  d.setDate(d.getDate() + duracao - 1);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run tests/unit/afastamento-date.test.ts
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/afastamento-date.ts tests/unit/afastamento-date.test.ts
git commit -m "feat(afastamentos): add calcDataFim pure util with tests"
```

---

## Task 5: AfastamentoEditDialog Component

**Files:**
- Create: `components/afastamentos/afastamento-edit-dialog.tsx`

This client component renders the "Editar dados" trigger button + Dialog. It is rendered by `ApprovalBar` (Task 7).

- [ ] **Step 1: Create the component**

Create `components/afastamentos/afastamento-edit-dialog.tsx`:

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calcDataFim } from "@/lib/afastamento-date";

export interface AfastamentoEditDialogProps {
  afastamentoId: string;
  tipos: { id: string; rotulo: string }[];
  unidades: { id: string; nome: string }[];
  initialValues: {
    tipo_id: string;
    unidade_id: string | null;
    data_inicio: string;
    duracao: number | null;
    cid: string | null;
    emissor: { tipo: string; no: string; uf: string } | null;
  };
}

const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus:border-ring";

export function AfastamentoEditDialog({
  afastamentoId,
  tipos,
  unidades,
  initialValues,
}: AfastamentoEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const [tipoId, setTipoId] = React.useState(initialValues.tipo_id);
  const [unidadeId, setUnidadeId] = React.useState(initialValues.unidade_id ?? "");
  const [dataInicio, setDataInicio] = React.useState(initialValues.data_inicio);
  const [duracao, setDuracao] = React.useState(String(initialValues.duracao ?? ""));
  const [cid, setCid] = React.useState(initialValues.cid ?? "");
  const [emissorTipo, setEmissorTipo] = React.useState(initialValues.emissor?.tipo ?? "");
  const [emissorNo, setEmissorNo] = React.useState(initialValues.emissor?.no ?? "");
  const [emissorUf, setEmissorUf] = React.useState(initialValues.emissor?.uf ?? "");

  const dataFim = React.useMemo(() => {
    const d = parseInt(duracao, 10);
    if (!dataInicio || isNaN(d) || d < 1) return "—";
    return calcDataFim(dataInicio, d);
  }, [dataInicio, duracao]);

  async function salvar() {
    const d = parseInt(duracao, 10);
    if (!tipoId || !dataInicio || isNaN(d) || d < 1) {
      toast.error("Tipo, data de início e duração são obrigatórios.");
      return;
    }
    setBusy(true);
    const r = await fetch(`/api/afastamentos/${afastamentoId}/editar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo_id:    tipoId,
        unidade_id: unidadeId || null,
        data_inicio: dataInicio,
        duracao:    d,
        cid:        cid.trim() || null,
        emissor:    emissorTipo.trim()
          ? { tipo: emissorTipo.trim(), no: emissorNo.trim(), uf: emissorUf.trim().toUpperCase() }
          : null,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.error ?? "Erro ao salvar alterações.");
      return;
    }
    toast.success("Dados atualizados.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" disabled={busy}>
            <PencilIcon className="size-4" aria-hidden="true" />
            Editar dados
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar dados do afastamento</DialogTitle>
          <DialogDescription>
            Corrija campos antes de aprovar. O colaborador não é notificado desta edição.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-tipo">Tipo</Label>
            <select
              id="edit-tipo"
              value={tipoId}
              onChange={(e) => setTipoId(e.target.value)}
              className={selectClass}
            >
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>{t.rotulo}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-unidade">Unidade</Label>
            <select
              id="edit-unidade"
              value={unidadeId}
              onChange={(e) => setUnidadeId(e.target.value)}
              className={selectClass}
            >
              <option value="">— Sem unidade —</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-inicio">Data início</Label>
            <Input
              id="edit-inicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-duracao">Duração (dias)</Label>
            <Input
              id="edit-duracao"
              type="number"
              min="1"
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <Label>
              Data fim{" "}
              <span className="font-normal text-[var(--color-fg-muted)]">(calculada)</span>
            </Label>
            <div className="flex h-8 items-center rounded-lg border border-input bg-muted px-2.5 font-mono text-sm text-[var(--color-fg-muted)]">
              {dataFim}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="edit-cid">CID</Label>
            <Input
              id="edit-cid"
              value={cid}
              onChange={(e) => setCid(e.target.value)}
              placeholder="Ex.: J18"
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <Label className="mb-1">Emissor</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-fg-muted)]">Tipo</span>
                <Input
                  value={emissorTipo}
                  onChange={(e) => setEmissorTipo(e.target.value)}
                  placeholder="CRM"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-fg-muted)]">Número</span>
                <Input
                  value={emissorNo}
                  onChange={(e) => setEmissorNo(e.target.value)}
                  placeholder="123456"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-fg-muted)]">UF</span>
                <Input
                  value={emissorUf}
                  onChange={(e) => setEmissorUf(e.target.value.toUpperCase())}
                  maxLength={2}
                  placeholder="SP"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={busy}>
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add components/afastamentos/afastamento-edit-dialog.tsx
git commit -m "feat(afastamentos): add AfastamentoEditDialog client component"
```

---

## Task 6: PATCH /api/afastamentos/[id]/editar Route

**Files:**
- Create: `app/api/afastamentos/[id]/editar/route.ts`

Auth pattern mirrors `app/api/afastamentos/[id]/aprovar/route.ts` — check admin flag OR equipe "oh" membership.

- [ ] **Step 1: Create the route**

Create `app/api/afastamentos/[id]/editar/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeEvento } from "@/lib/eventos";
import { calcDataFim } from "@/lib/afastamento-date";

const EditSchema = z.object({
  tipo_id:     z.string().uuid(),
  unidade_id:  z.string().uuid().nullable(),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duracao:     z.number().int().positive(),
  cid:         z.string().nullable(),
  emissor:     z.object({
    tipo: z.string().min(1),
    no:   z.string().min(1),
    uf:   z.string().length(2),
  }).nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("administrador")
    .eq("id", user.id)
    .single();
  const { data: m } = await supabase
    .from("equipe_usuarios")
    .select("equipes!inner(codigo)")
    .eq("usuario_id", user.id);
  const isOh = (m ?? []).some((r: any) => r.equipes?.codigo === "oh");
  if (!usuario?.administrador && !isOh) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = EditSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }

  const { tipo_id, unidade_id, data_inicio, duracao, cid, emissor } = parsed.data;
  const data_fim = calcDataFim(data_inicio, duracao);

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("afastamentos")
    .update({ tipo_id, unidade_id, data_inicio, duracao, data_fim, cid, emissor })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeEvento(admin, {
    tipoEntidade: "afastamento",
    entidadeId:   id,
    evento:       "editado",
    autorId:      user.id,
    dados:        { campos: Object.keys(parsed.data) },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add "app/api/afastamentos/[id]/editar/route.ts"
git commit -m "feat(afastamentos): PATCH /api/afastamentos/[id]/editar with auth + audit"
```

---

## Task 7: Wire ApprovalBar + Detail Page

**Files:**
- Modify: `components/detail/approval-bar.tsx`
- Modify: `app/app/afastamentos/[id]/page.tsx`

- [ ] **Step 1: Update ApprovalBar**

In `components/detail/approval-bar.tsx`, add the `editProps` prop and render `AfastamentoEditDialog`:

Replace the entire file with:

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
import {
  AfastamentoEditDialog,
  type AfastamentoEditDialogProps,
} from "@/components/afastamentos/afastamento-edit-dialog";

interface ApprovalBarProps {
  afastamentoId: string;
  editProps: {
    tipos: { id: string; rotulo: string }[];
    unidades: { id: string; nome: string }[];
    initialValues: AfastamentoEditDialogProps["initialValues"];
  };
}

export function ApprovalBar({ afastamentoId, editProps }: ApprovalBarProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [open, setOpen] = React.useState(false);

  async function aprovar() {
    setBusy(true);
    const r = await fetch(`/api/afastamentos/${afastamentoId}/aprovar`, { method: "POST" });
    if (!r.ok) {
      setBusy(false);
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
    if (!r.ok) {
      setBusy(false);
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
        <AfastamentoEditDialog
          afastamentoId={afastamentoId}
          tipos={editProps.tipos}
          unidades={editProps.unidades}
          initialValues={editProps.initialValues}
        />
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
              <Button
                onClick={rejeitar}
                disabled={busy}
                className="bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90"
              >
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

- [ ] **Step 2: Update app detail page to fetch tipos/unidades and pass editProps**

In `app/app/afastamentos/[id]/page.tsx`, expand the `Promise.all` from 2 to 4 queries:

```ts
const [
  { data: rawRow },
  { data: timelineData },
  { data: tiposData },
  { data: unidadesData },
] = await Promise.all([
  supabase
    .from("afastamentos")
    .select("*, empresas!inner(nome), unidades!inner(nome), afastamento_tipos!inner(rotulo)")
    .eq("id", id)
    .single(),
  supabase
    .from("eventos")
    .select("id, evento, ocorrido_em, usuarios:autor_id(nome)")
    .eq("tipo_entidade", "afastamento")
    .eq("entidade_id", id)
    .order("ocorrido_em", { ascending: false })
    .returns<TimelineEventRow[]>(),
  supabase
    .from("afastamento_tipos")
    .select("id, rotulo")
    .eq("requer_aprovacao", true)
    .order("ordem"),
  supabase
    .from("unidades")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome"),
]);
```

Update the `<ApprovalBar>` call (previously only took `afastamentoId`):

```tsx
{showApprovalBar && (
  <ApprovalBar
    afastamentoId={row.id}
    editProps={{
      tipos: (tiposData ?? []) as { id: string; rotulo: string }[],
      unidades: (unidadesData ?? []) as { id: string; nome: string }[],
      initialValues: {
        tipo_id:    row.tipo_id,
        unidade_id: row.unidade_id,
        data_inicio: row.data_inicio,
        duracao:    row.duracao,
        cid:        row.cid,
        emissor:    row.emissor,
      },
    }}
  />
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add components/detail/approval-bar.tsx "app/app/afastamentos/[id]/page.tsx"
git commit -m "feat(afastamentos): wire inline edit into ApprovalBar"
```

---

## Task 8: Active Afastamentos Page + Nav Entry

**Files:**
- Create: `app/app/afastamentos/ativos/page.tsx`
- Modify: `lib/nav.ts`

- [ ] **Step 1: Add "Ativos" to nav**

In `lib/nav.ts`, update the afastamentos group items:

```ts
{
  id: "afastamentos",
  label: "Afastamentos",
  href: "/app/afastamentos",
  requiredEquipe: "oh",
  items: [
    { label: "Lista",      href: "/app/afastamentos" },
    { label: "Ativos",     href: "/app/afastamentos/ativos" },
    { label: "Aprovações", href: "/app/afastamentos/aprovacoes" },
  ],
},
```

- [ ] **Step 2: Create active afastamentos page**

Create `app/app/afastamentos/ativos/page.tsx`:

```tsx
import Link from "next/link";
import { ClipboardListIcon } from "lucide-react";
import { requireEquipe } from "@/components/gates/equipe-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { FilterRail, type FilterChip } from "@/components/data/filter-rail";
import { StatusPill } from "@/components/data/status-pill";
import { EmptyState } from "@/components/data/empty-state";
import { KpiCard } from "@/components/painel/kpi-card";
import { parseFilterParams } from "@/lib/filter-rail";
import { fmtDate } from "@/lib/fmt-date";

type AtivoRow = {
  id: string;
  serial_id: number | null;
  cpf: string;
  colaborador_nome: string;
  data_inicio: string;
  data_fim: string;
  duracao: number | null;
  cid: string | null;
  situacao: string;
  afastamento_tipos: { codigo: string; rotulo: string };
};

export default async function AfastamentosAtivosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireEquipe("oh");
  const sp = await searchParams;
  const { q: searchQ, status: tipoCodigo } = parseFilterParams(sp);

  const supabase = await getSupabaseServer();
  // eslint-disable-next-line react-hooks/purity
  const today = new Date().toISOString().slice(0, 10);
  // eslint-disable-next-line react-hooks/purity
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  let ativosQuery = supabase
    .from("afastamentos")
    .select(
      "id, serial_id, cpf, colaborador_nome, data_inicio, data_fim, duracao, cid, situacao, afastamento_tipos!inner(codigo, rotulo)",
    )
    .neq("situacao", "rejeitado")
    .neq("situacao", "pendente")
    .gte("data_fim", today)
    .order("data_fim", { ascending: true });

  if (tipoCodigo) ativosQuery = ativosQuery.eq("afastamento_tipos.codigo", tipoCodigo);
  if (searchQ) {
    const safe = searchQ.replace(/[%_,]/g, "");
    ativosQuery = ativosQuery.or(`colaborador_nome.ilike.%${safe}%,cpf.ilike.%${safe}%`);
  }

  const [{ data }, { data: tiposData }] = await Promise.all([
    ativosQuery.returns<AtivoRow[]>(),
    supabase.from("afastamento_tipos").select("codigo, rotulo").eq("ativo", true).order("ordem"),
  ]);

  const rows = data ?? [];
  const total = rows.length;
  const prev31 = rows.filter((r) => r.afastamento_tipos.codigo === "prev_31").length;
  const prev91 = rows.filter((r) => r.afastamento_tipos.codigo === "prev_91").length;
  const thisWeek = rows.filter((r) => r.data_fim <= sevenDaysFromNow).length;

  const chips: FilterChip[] = [
    { value: "", label: "Todos" },
    ...(tiposData ?? []).map((t) => ({ value: t.codigo, label: t.rotulo })),
  ];

  const columns: DataTableColumn<AtivoRow>[] = [
    {
      key: "serial",
      label: "#",
      mono: true,
      render: (r) => r.serial_id != null ? `#${r.serial_id}` : "—",
    },
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
    { key: "tipo",    label: "Tipo",    render: (r) => r.afastamento_tipos.rotulo },
    { key: "cid",     label: "CID",     render: (r) => r.cid ?? "—", mono: true },
    { key: "inicio",  label: "Início",  render: (r) => fmtDate(r.data_inicio), mono: true },
    { key: "fim",     label: "Fim",     render: (r) => fmtDate(r.data_fim),    mono: true },
    { key: "dias",    label: "Dias",    render: (r) => r.duracao != null ? `${r.duracao} dias` : "—" },
    {
      key: "situacao",
      label: "Situação",
      render: (r) => <StatusPill domain="afastamento" situacao={r.situacao} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/app/painel" className="hover:text-foreground">Painel</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <Link href="/app/afastamentos" className="hover:text-foreground">Afastamentos</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">Ativos</span>
        </nav>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Afastamentos Ativos</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          {total} colaborador{total === 1 ? "" : "es"} afastado{total === 1 ? "" : "s"} hoje
        </p>
      </header>

      {total > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <KpiCard label="Total afastados" value={total} />
          <KpiCard label="Prev. 31 — Doença comum" value={prev31} tone="primary" />
          <KpiCard label="Prev. 91 — Acidente/ocupacional" value={prev91} tone="accent" />
          <KpiCard label="Retornam esta semana" value={thisWeek} tone="warning" />
        </div>
      )}

      <FilterRail
        basePath="/app/afastamentos/ativos"
        searchPlaceholder="Buscar por nome ou CPF…"
        chips={chips}
      />

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        getRowHref={(r) => `/app/afastamentos/${r.id}`}
        getRowClassName={(r) =>
          r.data_fim <= sevenDaysFromNow ? "bg-[var(--color-bg-subtle)]" : undefined
        }
        empty={
          <EmptyState
            icon={ClipboardListIcon}
            title="Nenhum afastamento ativo encontrado."
            hint="Ajuste os filtros ou verifique afastamentos com data de retorno futura."
          />
        }
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Run all unit tests**

```bash
npx vitest run tests/unit/
```

Expected: all tests passing (including the 4 `afastamento-date` tests from Task 4).

- [ ] **Step 5: Commit**

```bash
git add lib/nav.ts app/app/afastamentos/ativos/page.tsx
git commit -m "feat(afastamentos): add active afastamentos monitoring page with KPIs"
```

---

## Self-Check Before Marking Done

After all tasks are complete, verify:

- [ ] `npx vitest run tests/unit/` — all tests pass
- [ ] `npx tsc --noEmit` — no new errors
- [ ] Nav shows "Ativos" under Afastamentos dropdown
- [ ] App list shows `#` column first
- [ ] Portal list shows `#` column first
- [ ] App detail page titleSuffix shows `#123 · 123.456.789-00`
- [ ] Portal detail page FieldGrid first row shows `#`
- [ ] ApprovalBar shows "Editar dados" button (only when situacao = "pendente")
- [ ] Edit dialog calculates data_fim live when data_inicio or duracao changes
- [ ] PATCH route returns 403 for non-oh users, 400 for invalid body, 200 for success
- [ ] Active page shows correct row count in header subtitle
- [ ] Rows returning within 7 days are highlighted
