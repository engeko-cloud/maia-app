# Investigação Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-create investigações on ocorrência POST, deliver a token-gated public edit link in the confirmation email, hard-step-gate the public flow, mirror afastamento's approval lifecycle (submitted → approved/rejected), and add a code-rendered report with server-side PDF export.

**Architecture:** Investigation lifecycle expands from `em_andamento/finalizada/arquivada` to `em_andamento/em_aprovacao/aprovada/rejeitada/cancelada`. The same React `<InvestigacaoReport>` component drives both the share URL and the puppeteer PDF endpoint. Public routes use `getSupabaseAdmin()` and a per-investigation `token_publico` UUID; admin routes keep `requireSafetyOrAdmin()`. Step gates live in one pure module (`lib/investigacao-step-gates.ts`) shared by both flows.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (Postgres + Auth + Storage), Resend, Zod, react-hook-form, Vitest, Playwright, puppeteer-core + @sparticuz/chromium.

---

## Conventions used throughout this plan

- **Working directory:** `/Users/heizen/DEV/maia-app`. Database migrations live in `/Users/heizen/DEV/maia-db/supabase/migrations/`.
- **Test runner:** `npx vitest run <path>` for one file, `npx vitest run` for all. E2E uses Playwright; no new e2e specs in this plan (out of scope).
- **Type-check:** `npx tsc --noEmit`.
- **DB reset (local):** `cd /Users/heizen/DEV/maia-db && make db-reset`.
- **DB reset (linked remote):** `cd /Users/heizen/DEV/maia-db && supabase db reset --linked --yes`.
- **Regen types:** `cd /Users/heizen/DEV/maia-db && supabase gen types typescript --local > /Users/heizen/DEV/maia-app/lib/supabase/database.types.ts`. **Never** edit `database.types.ts` by hand.
- **Commit cadence:** one commit per task. Use Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com> trailer.
- **Style discipline:** cap radius at `rounded-md` for rectangles; circles may use `rounded-full` (e.g., step indicators); no emojis in code or copy.

---

## Task 1: Migration 022 — investigations workflow schema

**Files:**
- Create: `/Users/heizen/DEV/maia-db/supabase/migrations/022_investigacoes_workflow.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Phase 9: investigacoes workflow — new situacao vocabulary, public edit token,
-- decision columns mirroring afastamentos, and the "rejected requires motivo" check.

-- 1. Migrate any existing 'finalizada' rows to 'aprovada' (the new approved state).
update investigacoes set situacao = 'aprovada' where situacao = 'finalizada';
update investigacoes set situacao = 'cancelada' where situacao = 'arquivada';

-- 2. Replace the situacao check constraint with the expanded vocabulary.
alter table investigacoes drop constraint if exists investigacoes_situacao_check;
alter table investigacoes add constraint investigacoes_situacao_check
  check (situacao in ('em_andamento','em_aprovacao','aprovada','rejeitada','cancelada'));

-- 3. Public edit token. nextval-style default backfills existing rows automatically
--    because `default gen_random_uuid()` applies on column add.
alter table investigacoes
  add column token_publico    uuid unique not null default gen_random_uuid(),
  add column decidido_por     uuid references usuarios(id),
  add column decidido_em      timestamptz,
  add column motivo_rejeicao  text,
  add column enviada_em       timestamptz;

-- 4. Lookup index for public token routes.
create index idx_investigacoes_token_publico on investigacoes(token_publico);

-- 5. motivo_rejeicao is required iff situacao = 'rejeitada'.
alter table investigacoes add constraint investigacoes_rejeicao_motivo
  check (situacao <> 'rejeitada' or motivo_rejeicao is not null);
```

- [ ] **Step 2: Apply migration locally**

Run: `cd /Users/heizen/DEV/maia-db && make db-reset`
Expected: "Finished supabase db reset on branch main." with no errors. If a previous "investigacoes" row had `situacao = 'finalizada'`, the migration converts it to `'aprovada'` before the check constraint is replaced.

- [ ] **Step 3: Apply migration to linked remote**

Run: `cd /Users/heizen/DEV/maia-db && supabase db reset --linked --yes`
Expected: all 22 migrations applied. The pre-existing `gen_salt('bf')` seed failure is unrelated and may still occur — that's a known pre-existing issue.

- [ ] **Step 4: Regenerate Supabase types**

Run: `cd /Users/heizen/DEV/maia-db && supabase gen types typescript --local > /Users/heizen/DEV/maia-app/lib/supabase/database.types.ts`
Expected: file rewritten. Verify by grepping:
`grep -n "token_publico\\|motivo_rejeicao\\|enviada_em" /Users/heizen/DEV/maia-app/lib/supabase/database.types.ts | head`
should show those columns in the investigacoes Row/Insert/Update types.

- [ ] **Step 5: Typecheck**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit`
Expected: EXIT 0 (the migration only adds optional columns to the generated types, so nothing breaks downstream).

- [ ] **Step 6: Commit**

```bash
cd /Users/heizen/DEV/maia-db
git add supabase/migrations/022_investigacoes_workflow.sql
git commit -m "$(cat <<'EOF'
feat(db): investigacoes workflow — token_publico, decision columns, expanded situacao vocabulary

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"

cd /Users/heizen/DEV/maia-app
git add lib/supabase/database.types.ts
git commit -m "$(cat <<'EOF'
chore(types): regen Supabase types for investigacoes workflow migration

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Step-gate module (pure functions + tests)

**Files:**
- Create: `/Users/heizen/DEV/maia-app/lib/investigacao-step-gates.ts`
- Create: `/Users/heizen/DEV/maia-app/tests/unit/investigacao-step-gates.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `/Users/heizen/DEV/maia-app/tests/unit/investigacao-step-gates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { STEP_GATES, gatePassesUpTo, assertSubmittable } from "@/lib/investigacao-step-gates";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

const UUID_A = "00000000-0000-0000-0000-000000000001";
const UUID_B = "00000000-0000-0000-0000-000000000002";

const EMPTY: InvestigacaoDados = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] };
const ISHIKAWA_ONLY: InvestigacaoDados = {
  ishikawa: [{ categoria_id: UUID_A, grau_id: UUID_B, causas: [{ descricao: "x" }] }],
  plano_acao: [], participantes: [], fotos: [],
};
const PLANO_AND_ISHIKAWA: InvestigacaoDados = {
  ...ISHIKAWA_ONLY,
  plano_acao: [{ acao: "a", responsavel: "r", prazo: "2026-06-30", status: "pendente" }],
};
const READY: InvestigacaoDados = {
  ...PLANO_AND_ISHIKAWA,
  participantes: [{ nome: "Maria", email: null }],
};

describe("STEP_GATES", () => {
  it("declares the four steps in order", () => {
    expect(STEP_GATES.map((g) => g.step)).toEqual(["ishikawa", "plano_acao", "participantes", "fotos"]);
  });

  it("ishikawa gate requires at least one branch with a cause", () => {
    expect(STEP_GATES[0].min(EMPTY)).toBe(false);
    expect(STEP_GATES[0].min(ISHIKAWA_ONLY)).toBe(true);
  });

  it("plano_acao gate requires at least one item", () => {
    expect(STEP_GATES[1].min(ISHIKAWA_ONLY)).toBe(false);
    expect(STEP_GATES[1].min(PLANO_AND_ISHIKAWA)).toBe(true);
  });

  it("participantes gate requires at least one entry", () => {
    expect(STEP_GATES[2].min(PLANO_AND_ISHIKAWA)).toBe(false);
    expect(STEP_GATES[2].min(READY)).toBe(true);
  });

  it("fotos gate is always satisfied", () => {
    expect(STEP_GATES[3].min(EMPTY)).toBe(true);
  });
});

describe("gatePassesUpTo", () => {
  it("returns true when all gates up to and including target are satisfied", () => {
    expect(gatePassesUpTo(READY, 2)).toBe(true);
  });
  it("returns false when an earlier gate fails", () => {
    expect(gatePassesUpTo(EMPTY, 0)).toBe(false);
    expect(gatePassesUpTo(ISHIKAWA_ONLY, 1)).toBe(false);
  });
});

describe("assertSubmittable", () => {
  it("passes when ishikawa+plano+participantes are populated, fotos optional", () => {
    expect(() => assertSubmittable(READY)).not.toThrow();
  });
  it("throws on missing ishikawa", () => {
    expect(() => assertSubmittable(EMPTY)).toThrow(/ishikawa/i);
  });
  it("throws on missing plano de ação", () => {
    expect(() => assertSubmittable(ISHIKAWA_ONLY)).toThrow(/plano/i);
  });
  it("throws on missing participantes", () => {
    expect(() => assertSubmittable(PLANO_AND_ISHIKAWA)).toThrow(/participante/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/heizen/DEV/maia-app && npx vitest run tests/unit/investigacao-step-gates.test.ts`
Expected: FAIL — `Cannot find module '@/lib/investigacao-step-gates'`.

- [ ] **Step 3: Write the implementation**

Create `/Users/heizen/DEV/maia-app/lib/investigacao-step-gates.ts`:

```ts
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

export type GateStep = "ishikawa" | "plano_acao" | "participantes" | "fotos";

export interface StepGate {
  step: GateStep;
  /** Returns true when the user may advance past this step. */
  min: (dados: InvestigacaoDados) => boolean;
  /** Human message to surface when the gate is not satisfied. */
  message: string;
}

// Per-field completeness of plano_acao items is enforced by InvestigacaoDadosSchema
// (acao.min(1), responsavel.min(1), prazo ISO regex, status enum). Gates only check counts.
export const STEP_GATES: StepGate[] = [
  {
    step: "ishikawa",
    min: (d) => d.ishikawa.some((b) => b.causas.length > 0),
    message: "Adicione ao menos uma causa em qualquer categoria do Ishikawa.",
  },
  {
    step: "plano_acao",
    min: (d) => d.plano_acao.length >= 1,
    message: "Adicione ao menos uma ação ao plano de ação.",
  },
  {
    step: "participantes",
    min: (d) => d.participantes.length >= 1,
    message: "Adicione ao menos um participante.",
  },
  {
    step: "fotos",
    min: () => true,
    message: "",
  },
];

/** True when every gate up to and including stepIndex passes. */
export function gatePassesUpTo(dados: InvestigacaoDados, stepIndex: number): boolean {
  for (let i = 0; i <= stepIndex; i++) {
    if (!STEP_GATES[i].min(dados)) return false;
  }
  return true;
}

/** Throws the first unmet gate message (excluding optional fotos). Used by submit and approve. */
export function assertSubmittable(dados: InvestigacaoDados): void {
  for (const gate of STEP_GATES) {
    if (gate.step === "fotos") continue;
    if (!gate.min(dados)) {
      throw new Error(gate.message);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd /Users/heizen/DEV/maia-app && npx vitest run tests/unit/investigacao-step-gates.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Typecheck**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add lib/investigacao-step-gates.ts tests/unit/investigacao-step-gates.test.ts
git commit -m "$(cat <<'EOF'
feat(investigacao): step-gate module + tests

Pure functions shared by public step-by-step flow and admin finalize gate.
Source of truth for 'what makes an investigation complete'.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Extend status-pill + investigacao-state for new vocabulary

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/lib/status-pill.ts`
- Modify: `/Users/heizen/DEV/maia-app/lib/investigacao-state.ts`
- Modify: `/Users/heizen/DEV/maia-app/tests/unit/status-pill.test.ts`

- [ ] **Step 1: Update investigacao-state.ts**

Replace the existing content of `/Users/heizen/DEV/maia-app/lib/investigacao-state.ts`:

```ts
export const INVESTIGACAO_SITUACOES = [
  "em_andamento", "em_aprovacao", "aprovada", "rejeitada", "cancelada",
] as const;
export type InvestigacaoSituacao = (typeof INVESTIGACAO_SITUACOES)[number];

const SITUACAO_LABELS: Record<InvestigacaoSituacao, string> = {
  em_andamento: "Em andamento",
  em_aprovacao: "Aguardando aprovação",
  aprovada:     "Aprovada",
  rejeitada:    "Rejeitada",
  cancelada:    "Cancelada",
};

export function investigacaoSituacaoLabel(s: string): string {
  return SITUACAO_LABELS[s as InvestigacaoSituacao] ?? s;
}

export const PLANO_ACAO_STATUS = ["pendente", "em_andamento", "concluida", "cancelada"] as const;
export type PlanoAcaoStatus = (typeof PLANO_ACAO_STATUS)[number];

const PLANO_ACAO_LABELS: Record<PlanoAcaoStatus, string> = {
  pendente:     "Pendente",
  em_andamento: "Em andamento",
  concluida:    "Concluída",
  cancelada:    "Cancelada",
};

export function planoAcaoStatusLabel(s: string): string {
  return PLANO_ACAO_LABELS[s as PlanoAcaoStatus] ?? s;
}
```

- [ ] **Step 2: Extend status-pill.ts with an "investigacao" domain**

Edit `/Users/heizen/DEV/maia-app/lib/status-pill.ts` to add an investigation domain:

```ts
export type StatusTone =
  | "pending"
  | "approved"
  | "rejected"
  | "draft"
  | "success"
  | "new"
  | "investigating";

export type StatusDomain = "afastamento" | "ocorrencia" | "investigacao";

export interface StatusPillSpec {
  tone: StatusTone;
  label: string;
}

const AFASTAMENTO: Record<string, StatusPillSpec> = {
  pendente:   { tone: "pending",  label: "Pendente" },
  rejeitado:  { tone: "rejected", label: "Rejeitado" },
  finalizado: { tone: "success",  label: "Finalizado" },
  cancelado:  { tone: "draft",    label: "Cancelado" },
};

const OCORRENCIA: Record<string, StatusPillSpec> = {
  aberta:           { tone: "new",           label: "Aberta" },
  em_investigacao:  { tone: "investigating", label: "Em investigação" },
  concluida:        { tone: "success",       label: "Concluída" },
};

const INVESTIGACAO: Record<string, StatusPillSpec> = {
  em_andamento: { tone: "new",      label: "Em andamento" },
  em_aprovacao: { tone: "pending",  label: "Aguardando aprovação" },
  aprovada:     { tone: "approved", label: "Aprovada" },
  rejeitada:    { tone: "rejected", label: "Rejeitada" },
  cancelada:    { tone: "draft",    label: "Cancelada" },
};

export function resolveStatusPill(domain: StatusDomain, situacao: string): StatusPillSpec {
  const map =
    domain === "afastamento" ? AFASTAMENTO :
    domain === "ocorrencia"  ? OCORRENCIA  : INVESTIGACAO;
  return map[situacao] ?? { tone: "draft", label: situacao };
}
```

- [ ] **Step 3: Add tests for the new domain**

Append to `/Users/heizen/DEV/maia-app/tests/unit/status-pill.test.ts` (read the file first to find the right spot to insert; add a new `describe` block at the end):

```ts
describe("investigacao status pills", () => {
  it("maps em_aprovacao to pending tone", () => {
    expect(resolveStatusPill("investigacao", "em_aprovacao")).toEqual({
      tone: "pending", label: "Aguardando aprovação",
    });
  });
  it("maps aprovada to approved tone", () => {
    expect(resolveStatusPill("investigacao", "aprovada")).toEqual({
      tone: "approved", label: "Aprovada",
    });
  });
  it("maps rejeitada to rejected tone", () => {
    expect(resolveStatusPill("investigacao", "rejeitada")).toEqual({
      tone: "rejected", label: "Rejeitada",
    });
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/heizen/DEV/maia-app && npx vitest run tests/unit/status-pill.test.ts tests/unit/investigacao-permissions.test.ts`
Expected: all pass. (Permissions test is included because it imports `investigacao-state`; verify no regression.)

- [ ] **Step 5: Typecheck**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit`
Expected: EXIT 0. Note: this may surface a downstream consumer of the removed `finalizada` literal. If so, the offending file must be updated to use `aprovada`. Check `components/investigacoes/investigacao-summary.tsx` and `components/investigacoes/investigation-status.tsx` — both currently type `situacao: "em_andamento" | "finalizada"`. Update those literals to `"em_andamento" | "aprovada"` and the comparisons accordingly (e.g., `investigacao?.situacao === "finalizada"` → `investigacao?.situacao === "aprovada"`).

- [ ] **Step 6: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add lib/status-pill.ts lib/investigacao-state.ts tests/unit/status-pill.test.ts components/investigacoes/investigacao-summary.tsx components/investigacoes/investigation-status.tsx
git commit -m "$(cat <<'EOF'
feat(investigacao): extend status-pill + state vocabulary for approval lifecycle

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Public form server page — read by token, situacao-aware shell

**Files:**
- Create: `/Users/heizen/DEV/maia-app/app/(public)/investigacoes/editar/[token]/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { notFound, redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PublicFormShell } from "@/components/forms/public-form-shell";
import { PublicInvestigacaoForm } from "./form";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

const EMPTY: InvestigacaoDados = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] };

const SITUACAO_BANNERS: Record<string, string> = {
  em_andamento: "Preencha as etapas da investigação. Você pode salvar e voltar depois.",
  em_aprovacao: "Esta investigação foi enviada e aguarda aprovação da equipe de segurança.",
  aprovada:     "Esta investigação foi aprovada. O conteúdo agora é somente leitura.",
  cancelada:    "Esta investigação foi cancelada e não pode mais ser editada.",
  rejeitada:    "Sua investigação precisa de ajustes. Veja o motivo abaixo e atualize as etapas.",
};

export default async function PublicInvestigacaoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: inv } = await supabase
    .from("investigacoes")
    .select(`
      id, ocorrencia_id, situacao, dados, motivo_rejeicao,
      decidido_em, token_publico,
      ocorrencias!inner(
        id, serial_id, tipo, data_ocorrencia, descricao,
        colaborador_nome, cpf, token_edicao,
        empresas!inner(nome),
        unidades!inner(nome)
      )
    `)
    .eq("token_publico", token)
    .single();

  if (!inv) notFound();

  const [{ data: categorias }, { data: graus }, causasRes] = await Promise.all([
    supabase.from("investigacao_categorias").select("id, codigo, rotulo, ativo, ordem").order("ordem"),
    supabase.from("investigacao_graus").select("id, codigo, rotulo, ativo, ordem").order("ordem"),
    supabase.from("investigacao_causas").select("id, categoria_id, texto").eq("ativo", true).order("ordem"),
  ]);

  const causasByCategoria: Record<string, Array<{ id: string; texto: string }>> = {};
  for (const c of (causasRes.data ?? [])) {
    (causasByCategoria[c.categoria_id] ??= []).push({ id: c.id, texto: c.texto });
  }

  const dados = (inv.dados ?? EMPTY) as InvestigacaoDados;
  const o = inv.ocorrencias;

  return (
    <PublicFormShell
      title={`Investigação #${o.serial_id ?? "—"}`}
      banner={SITUACAO_BANNERS[inv.situacao] ?? ""}
      callout={
        inv.situacao === "rejeitada" && inv.motivo_rejeicao ? (
          <div className="rounded-md border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-4">
            <p className="text-sm font-semibold text-[var(--color-danger)]">Motivo da rejeição</p>
            <p className="mt-1 text-sm text-[var(--color-fg)] whitespace-pre-wrap">{inv.motivo_rejeicao}</p>
          </div>
        ) : null
      }
    >
      <PublicInvestigacaoForm
        token={inv.token_publico}
        situacao={inv.situacao}
        initialDados={dados}
        ocorrencia={{
          tipo:            o.tipo,
          data_ocorrencia: o.data_ocorrencia,
          empresa_nome:    o.empresas.nome,
          unidade_nome:    o.unidades.nome,
          colaborador_nome: o.colaborador_nome,
          token_edicao:    o.token_edicao,
        }}
        categorias={categorias ?? []}
        graus={graus ?? []}
        causasByCategoria={causasByCategoria}
      />
    </PublicFormShell>
  );
}
```

- [ ] **Step 2: Typecheck (form.tsx will be created in Task 5; expect a missing-import error here)**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit`
Expected: error on `import { PublicInvestigacaoForm } from "./form"` — that's fine, the next task creates it.

- [ ] **Step 3: Stop — proceed to Task 5. Commit at end of Task 5 along with the client component.**

---

## Task 5: Public form client component with hard step gating + autosave

**Files:**
- Create: `/Users/heizen/DEV/maia-app/app/(public)/investigacoes/editar/[token]/form.tsx`

- [ ] **Step 1: Write the client form**

```tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/detail/stepper";
import { IshikawaBranchEditor } from "@/components/investigacoes/ishikawa-branch-editor";
import { ActionItemEditor } from "@/components/investigacoes/action-item-editor";
import { ParticipanteList } from "@/components/investigacoes/participante-list";
import { FotoUploader } from "@/components/investigacoes/foto-uploader";
import {
  InvestigacaoDadosSchema,
  type InvestigacaoDados,
} from "@/lib/investigacao-dados";
import { STEP_GATES } from "@/lib/investigacao-step-gates";

interface Categoria { id: string; codigo: string; rotulo: string; ativo: boolean; }
interface Grau      { id: string; codigo: string; rotulo: string; ativo: boolean; }

interface Props {
  token: string;
  situacao: string;
  initialDados: InvestigacaoDados;
  ocorrencia: {
    tipo: string;
    data_ocorrencia: string;
    empresa_nome: string;
    unidade_nome: string;
    colaborador_nome: string | null;
    token_edicao: string;
  };
  categorias: Categoria[];
  graus: Grau[];
  causasByCategoria: Record<string, Array<{ id: string; texto: string }>>;
}

const STEP_LABELS = ["Ishikawa", "Plano de ação", "Participantes", "Fotos"] as const;
const LAST = STEP_LABELS.length - 1;

const READ_ONLY_SITUACOES = new Set(["em_aprovacao", "aprovada", "cancelada"]);

export function PublicInvestigacaoForm({
  token, situacao, initialDados, ocorrencia, categorias, graus, causasByCategoria,
}: Props) {
  const router = useRouter();
  const readOnly = READ_ONLY_SITUACOES.has(situacao);

  const [step, setStep] = React.useState(0);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [busy, setBusy] = React.useState(false);

  const form = useForm<InvestigacaoDados>({
    resolver: zodResolver(InvestigacaoDadosSchema),
    defaultValues: initialDados,
    mode: "onSubmit",
  });

  // Seed empty branches for every active categoria so the editor always shows all 6Ms.
  const activeCategorias = React.useMemo(
    () => categorias.filter((c) => c.ativo).sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [categorias],
  );
  React.useEffect(() => {
    const current = form.getValues("ishikawa");
    const known = new Set(current.map((b) => b.categoria_id));
    const missing = activeCategorias.filter((c) => !known.has(c.id));
    if (missing.length > 0) {
      form.setValue("ishikawa", [
        ...current,
        ...missing.map((c) => ({
          categoria_id: c.id, grau_id: null, causas: [] as Array<{ causa_id?: string; descricao: string }>,
        })),
      ], { shouldDirty: false });
    }
  }, [activeCategorias, form]);

  const planoAcao = useFieldArray({ control: form.control, name: "plano_acao" });

  // Autosave debounced.
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSave = React.useCallback(async (dados: InvestigacaoDados) => {
    const res = await fetch(`/api/public/investigacoes/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dados }),
    });
    if (res.ok) setSavedAt(new Date());
  }, [token]);

  React.useEffect(() => {
    if (readOnly) return;
    const sub = form.watch((value) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        // Strip empty ishikawa branches before persisting (matches admin form).
        const cleaned: InvestigacaoDados = {
          ...(value as InvestigacaoDados),
          ishikawa: ((value.ishikawa ?? []) as InvestigacaoDados["ishikawa"]).map((b) => ({
            ...b,
            causas: (b.causas ?? []).filter((c) => c.descricao.trim().length > 0),
          })).filter((b) => b.causas.length > 0),
        };
        void flushSave(cleaned);
      }, 800);
    });
    return () => {
      sub.unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, flushSave, readOnly]);

  const dados = form.watch();
  const currentGate = STEP_GATES[step];
  const canAdvance = currentGate.min(dados);

  async function submeter() {
    if (readOnly) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/public/investigacoes/${token}/submeter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dados: form.getValues() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast.success("Investigação enviada para aprovação.");
      router.push(`/ocorrencias/status/${ocorrencia.token_edicao}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
      setBusy(false);
    }
  }

  const categoriaRotulo = React.useCallback(
    (id: string) => categorias.find((c) => c.id === id)?.rotulo ?? "Categoria removida",
    [categorias],
  );
  const categoriaActive = React.useCallback(
    (id: string) => categorias.find((c) => c.id === id)?.ativo ?? false,
    [categorias],
  );

  return (
    <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
      <Stepper current={step} steps={STEP_LABELS.map((s) => ({ label: s }))} />

      {step === 0 ? (
        <div className="flex flex-col gap-4">
          {form.watch("ishikawa").map((b, idx) => {
            const present = !!categorias.find((c) => c.id === b.categoria_id);
            const active  = categoriaActive(b.categoria_id);
            const readOnlyLabel = !present ? "categoria removida" : !active ? "categoria desativada" : undefined;
            return (
              <Controller
                key={`${b.categoria_id}-${idx}`}
                control={form.control}
                name={`ishikawa.${idx}`}
                render={({ field }) => (
                  <IshikawaBranchEditor
                    branch={field.value}
                    categoriaRotulo={categoriaRotulo(b.categoria_id)}
                    graus={graus.filter((g) => g.ativo)}
                    causas={causasByCategoria[b.categoria_id] ?? []}
                    onChange={field.onChange}
                    readOnly={readOnly || !present || !active}
                    readOnlyLabel={readOnlyLabel}
                  />
                )}
              />
            );
          })}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          {planoAcao.fields.map((field, idx) => (
            <Controller
              key={field.id}
              control={form.control}
              name={`plano_acao.${idx}`}
              render={({ field: f }) => (
                <ActionItemEditor
                  item={f.value}
                  index={idx}
                  onChange={f.onChange}
                  onRemove={readOnly ? () => {} : () => planoAcao.remove(idx)}
                />
              )}
            />
          ))}
          {readOnly ? null : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => planoAcao.append({ acao: "", responsavel: "", prazo: "", status: "pendente" })}
            >
              <PlusIcon className="size-4" aria-hidden="true" />
              Adicionar ação
            </Button>
          )}
        </div>
      ) : null}

      {step === 2 ? (
        <Controller
          control={form.control}
          name="participantes"
          render={({ field }) => (
            <ParticipanteList items={field.value} onChange={readOnly ? () => {} : field.onChange} />
          )}
        />
      ) : null}

      {step === 3 ? (
        <Controller
          control={form.control}
          name="fotos"
          render={({ field }) => (
            <FotoUploader
              ocorrenciaId={ocorrencia.token_edicao /* legacy prop name */}
              items={field.value}
              onChange={readOnly ? () => {} : field.onChange}
              uploadUrl={`/api/public/investigacoes/${token}/foto`}
            />
          )}
        />
      ) : null}

      <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
            Voltar
          </Button>
          {step < LAST ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy || (!readOnly && !canAdvance)}
              title={!readOnly && !canAdvance ? currentGate.message : undefined}
              onClick={() => setStep((s) => s + 1)}
            >
              Avançar
            </Button>
          ) : (
            !readOnly && (
              <Button type="button" disabled={busy} onClick={() => void submeter()}>
                Enviar para aprovação
              </Button>
            )
          )}
        </div>
        {readOnly ? (
          <span className="text-sm text-[var(--color-fg-muted)]">Somente leitura.</span>
        ) : (
          <span className="text-sm text-[var(--color-fg-muted)]">
            {savedAt ? `Salvo às ${savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Salvando automaticamente."}
          </span>
        )}
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Extend FotoUploader to accept an optional uploadUrl prop**

Read `/Users/heizen/DEV/maia-app/components/investigacoes/foto-uploader.tsx`. Find the existing upload fetch (which posts to `/api/private/investigacoes/upload`). Make the URL configurable:

Add to the Props interface:
```ts
uploadUrl?: string;  // default: /api/private/investigacoes/upload
```

Where it does `fetch("/api/private/investigacoes/upload", ...)`, change to:
```ts
fetch(props.uploadUrl ?? "/api/private/investigacoes/upload", ...)
```

The public upload route (Task 7) will accept the same multipart shape but will be token-authenticated rather than session-authenticated.

- [ ] **Step 3: Typecheck (autosave/submit/foto routes don't exist yet — that's fine for now; we'll create them next)**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit`
Expected: EXIT 0 (the form makes HTTP calls; missing routes are runtime concerns, not compile errors).

- [ ] **Step 4: Commit (paired with Task 4 page)**

```bash
cd /Users/heizen/DEV/maia-app
git add app/\(public\)/investigacoes components/investigacoes/foto-uploader.tsx
git commit -m "$(cat <<'EOF'
feat(investigacao): public token-gated investigation form (step-gated + autosave)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Public autosave route

**Files:**
- Create: `/Users/heizen/DEV/maia-app/app/api/public/investigacoes/[token]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { InvestigacaoDadosSchema } from "@/lib/investigacao-dados";

const Body = z.object({ dados: InvestigacaoDadosSchema });

const EDITABLE = new Set(["em_andamento", "rejeitada"]);

// Autosave: público via token. Preserva situacao (em_andamento ↔ em_andamento,
// rejeitada ↔ rejeitada). Recusa autosave em estados de leitura.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 422 });
  }

  const admin = getSupabaseAdmin();
  const { data: inv, error: lookupErr } = await admin
    .from("investigacoes")
    .select("id, ocorrencia_id, situacao")
    .eq("token_publico", token)
    .single();
  if (lookupErr || !inv) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!EDITABLE.has(inv.situacao)) {
    return NextResponse.json({ error: "not_editable", situacao: inv.situacao }, { status: 409 });
  }

  const { error: upErr } = await admin
    .from("investigacoes")
    .update({ dados: parsed.data.dados })
    .eq("id", inv.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Atualiza ocorrencia.situacao se a investigação ainda está em rascunho.
  if (inv.situacao === "em_andamento") {
    const d = parsed.data.dados;
    const nonEmpty =
      d.ishikawa.length + d.plano_acao.length + d.participantes.length + d.fotos.length > 0;
    await admin
      .from("ocorrencias")
      .update({ situacao: nonEmpty ? "em_investigacao" : "aberta" })
      .eq("id", inv.ocorrencia_id);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add app/api/public/investigacoes/\[token\]/route.ts
git commit -m "$(cat <<'EOF'
feat(api): public investigacao autosave route (POST /api/public/investigacoes/[token])

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Public foto upload route

**Files:**
- Create: `/Users/heizen/DEV/maia-app/app/api/public/investigacoes/[token]/foto/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FOTOS_PER_INVESTIGACAO = 10;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const EDITABLE = new Set(["em_andamento", "rejeitada"]);

// Upload de fotos público via token. Mesmas regras (5MB, 10 max, jpeg/png/webp)
// da rota privada; diferença é auth por token em vez de sessão.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const admin = getSupabaseAdmin();
  const { data: inv, error: invErr } = await admin
    .from("investigacoes")
    .select("id, ocorrencia_id, situacao, dados")
    .eq("token_publico", token)
    .single();
  if (invErr || !inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!EDITABLE.has(inv.situacao)) {
    return NextResponse.json({ error: "not_editable", situacao: inv.situacao }, { status: 409 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large", max_bytes: MAX_BYTES }, { status: 413 });
  if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: "invalid_mime", allowed: [...ALLOWED_MIME] }, { status: 415 });

  const fotos = (inv.dados as { fotos?: unknown[] } | null)?.fotos ?? [];
  if (Array.isArray(fotos) && fotos.length >= MAX_FOTOS_PER_INVESTIGACAO) {
    return NextResponse.json({ error: "max_fotos_reached", max: MAX_FOTOS_PER_INVESTIGACAO }, { status: 409 });
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `investigacoes/${inv.ocorrencia_id}/${randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await admin.storage
    .from("attachments")
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  return NextResponse.json({ path });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add app/api/public/investigacoes/\[token\]/foto
git commit -m "$(cat <<'EOF'
feat(api): public investigacao foto upload route (token-auth)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Public submeter route + investigacao-em-aprovacao email

**Files:**
- Create: `/Users/heizen/DEV/maia-app/emails/investigacao-em-aprovacao.ts`
- Create: `/Users/heizen/DEV/maia-app/app/api/public/investigacoes/[token]/submeter/route.ts`
- Modify: `/Users/heizen/DEV/maia-app/lib/mail/send.ts`

- [ ] **Step 1: Write the email template**

`/Users/heizen/DEV/maia-app/emails/investigacao-em-aprovacao.ts`:

```ts
import { layout } from "./_layout";
import { recordTable } from "./_record-table";
import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";

export type InvestigacaoEmAprovacaoEmail = {
  serial_id?: number | null;
  ocorrencia_id:   string;
  tipo:            string;
  data_ocorrencia: string;
  empresa_nome:    string;
  unidade_nome:    string;
  causas_count:    number;
  acoes_count:     number;
  participantes_count: number;
  fotos_count:     number;
  base_url:        string;
};

export function investigacaoEmAprovacao(data: { o: InvestigacaoEmAprovacaoEmail }): string {
  const { o } = data;
  const link = `${o.base_url}/ocorrencias/${o.ocorrencia_id}/investigacao`;
  const idLabel = o.serial_id != null ? `#${o.serial_id}` : "";
  const body = `
    <p style="margin:16px 0;">A investigação <strong>${escapeHtml(idLabel)}</strong> foi preenchida e aguarda revisão.</p>
    ${recordTable([
      { label: "Identificador", value: idLabel || "—" },
      { label: "Tipo",      value: o.tipo },
      { label: "Data",      value: o.data_ocorrencia },
      { label: "Empresa",   value: o.empresa_nome },
      { label: "Unidade",   value: o.unidade_nome },
      { label: "Resumo",    value: `${o.causas_count} causas · ${o.acoes_count} ações · ${o.participantes_count} participantes · ${o.fotos_count} fotos` },
    ])}
    <div style="margin-top:16px;">
      <a href="${escapeHtml(link)}" style="display:inline-block;background:${EMAIL_COLORS.primary};color:${EMAIL_COLORS.primaryFg};padding:10px 16px;border-radius:6px;text-decoration:none;">Revisar e decidir</a>
    </div>
  `;
  return layout(`Investigação ${idLabel} pronta para aprovação`, body);
}
```

- [ ] **Step 2: Register the template**

Edit `/Users/heizen/DEV/maia-app/lib/mail/send.ts`. Add the import:

```ts
import { investigacaoEmAprovacao, type InvestigacaoEmAprovacaoEmail } from "@/emails/investigacao-em-aprovacao";
```

Add a new entry to TEMPLATES (alongside the others):

```ts
  "investigacao-em-aprovacao": {
    subject: (data: { o: InvestigacaoEmAprovacaoEmail }) => `Investigação${tagId(data.o.serial_id)} pronta para aprovação`,
    render:  investigacaoEmAprovacao,
  },
```

- [ ] **Step 3: Write the submeter route**

`/Users/heizen/DEV/maia-app/app/api/public/investigacoes/[token]/submeter/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { InvestigacaoDadosSchema } from "@/lib/investigacao-dados";
import { assertSubmittable } from "@/lib/investigacao-step-gates";
import { writeEvento } from "@/lib/eventos";
import { sendMail } from "@/lib/mail/send";
import { resolveSafetyRecipients, makeSupabaseRecipientSources } from "@/lib/safety-notify";

const Body = z.object({ dados: InvestigacaoDadosSchema });

const SUBMITTABLE = new Set(["em_andamento", "rejeitada"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 422 });

  try {
    assertSubmittable(parsed.data.dados);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "incompleto" }, { status: 422 });
  }

  const admin = getSupabaseAdmin();
  const { data: inv, error: lookupErr } = await admin
    .from("investigacoes")
    .select(`
      id, ocorrencia_id, situacao,
      ocorrencias!inner(
        id, serial_id, tipo, data_ocorrencia,
        empresas!inner(nome),
        unidades!inner(nome)
      )
    `)
    .eq("token_publico", token)
    .single();
  if (lookupErr || !inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!SUBMITTABLE.has(inv.situacao)) {
    return NextResponse.json({ error: "invalid_transition", situacao: inv.situacao }, { status: 409 });
  }

  const { error: upErr } = await admin
    .from("investigacoes")
    .update({
      dados:       parsed.data.dados,
      situacao:    "em_aprovacao",
      enviada_em:  new Date().toISOString(),
      // Clear stale rejection bookkeeping on resubmit.
      motivo_rejeicao: null,
      decidido_por:    null,
      decidido_em:     null,
    })
    .eq("id", inv.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await admin.from("ocorrencias").update({ situacao: "em_investigacao" }).eq("id", inv.ocorrencia_id);

  await writeEvento(admin, {
    tipoEntidade: "investigacao", entidadeId: inv.id, evento: "investigacao_iniciada",
  });

  // Email safety team.
  try {
    const sources = makeSupabaseRecipientSources(admin);
    const recipients = await resolveSafetyRecipients(sources);
    if (recipients.length > 0) {
      const d = parsed.data.dados;
      const causasCount = d.ishikawa.reduce((acc, b) => acc + b.causas.length, 0);
      await sendMail({
        template: "investigacao-em-aprovacao",
        to: recipients,
        data: { o: {
          serial_id:           inv.ocorrencias.serial_id,
          ocorrencia_id:       inv.ocorrencia_id,
          tipo:                inv.ocorrencias.tipo,
          data_ocorrencia:     inv.ocorrencias.data_ocorrencia,
          empresa_nome:        inv.ocorrencias.empresas.nome,
          unidade_nome:        inv.ocorrencias.unidades.nome,
          causas_count:        causasCount,
          acoes_count:         d.plano_acao.length,
          participantes_count: d.participantes.length,
          fotos_count:         d.fotos.length,
          base_url:            process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "",
        } },
      });
      await writeEvento(admin, {
        tipoEntidade: "investigacao", entidadeId: inv.id,
        evento: "email_enviado", dados: { template: "investigacao-em-aprovacao", to: recipients },
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeEvento(admin, {
      tipoEntidade: "investigacao", entidadeId: inv.id,
      evento: "email_enviado", dados: { template: "investigacao-em-aprovacao", error: msg },
    });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add emails/investigacao-em-aprovacao.ts lib/mail/send.ts app/api/public/investigacoes/\[token\]/submeter
git commit -m "$(cat <<'EOF'
feat(api): public investigacao submeter + investigacao-em-aprovacao email

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Receipt email — add "Preencher investigação" CTA

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/emails/ocorrencia-receipt.ts`
- Modify: `/Users/heizen/DEV/maia-app/app/api/public/ocorrencias/route.ts`

- [ ] **Step 1: Add investigacao_url to the email type and body**

Replace `/Users/heizen/DEV/maia-app/emails/ocorrencia-receipt.ts`:

```ts
import { layout } from "./_layout";
import { recordTable } from "./_record-table";
import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";

export type OcorrenciaEmail = {
  serial_id?: number | null;
  tipo: string;
  data_ocorrencia: string;
  empresa_nome: string;
  unidade_nome: string;
  descricao: string;
  status_url?: string;
  investigacao_url?: string;
};

export function ocorrenciaReceipt(data: { o: OcorrenciaEmail }): string {
  const { o } = data;
  const idLabel = o.serial_id != null ? `#${o.serial_id}` : "";
  const body = `
    <p style="margin:16px 0;">Sua ocorrência <strong>${escapeHtml(idLabel)}</strong> foi registrada. Para iniciar a investigação, use o botão abaixo. Você pode acompanhar o andamento a qualquer momento.</p>
    ${recordTable([
      { label: "Identificador", value: idLabel || "—" },
      { label: "Tipo",          value: o.tipo },
      { label: "Data",          value: o.data_ocorrencia },
      { label: "Empresa",       value: o.empresa_nome },
      { label: "Unidade",       value: o.unidade_nome },
      { label: "Descrição",     value: o.descricao },
    ])}
    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
      ${o.investigacao_url ? `
      <a href="${escapeHtml(o.investigacao_url)}" style="display:inline-block;background:${EMAIL_COLORS.primary};color:${EMAIL_COLORS.primaryFg};padding:10px 16px;border-radius:6px;text-decoration:none;">Preencher investigação</a>
      ` : ""}
      ${o.status_url ? `
      <a href="${escapeHtml(o.status_url)}" style="display:inline-block;background:transparent;color:${EMAIL_COLORS.primary};border:1px solid ${EMAIL_COLORS.primary};padding:10px 16px;border-radius:6px;text-decoration:none;">Acompanhar status</a>
      ` : ""}
    </div>
  `;
  return layout("Recebemos sua ocorrência", body);
}
```

- [ ] **Step 2: Wire investigacao_url from the create route**

Edit `/Users/heizen/DEV/maia-app/app/api/public/ocorrencias/route.ts`. Find the section that does the best-effort investigacao insert (currently lines 123-134, the `try { await supabase.from("investigacoes").insert({...}) }` block). Replace that block with one that captures `token_publico` from the inserted row:

Replace:
```ts
  // Cria investigação vazia (best-effort) para o PATCH funcionar desde o dia 0.
  try {
    await supabase.from("investigacoes").insert({
      ocorrencia_id: ocorrenciaRow.id,
      dados: EMPTY_DADOS,
      situacao: "em_andamento",
    });
  } catch (err: unknown) {
    await writeEvento(supabase, {
      tipoEntidade: "ocorrencia", entidadeId: ocorrenciaRow.id, evento: "email_enviado",
      dados: { investigacao_autocreate_failed: String(err) },
    });
  }
```

With:
```ts
  // Cria investigação vazia para o PATCH funcionar desde o dia 0 e captura
  // token_publico para incluir no email de recibo.
  let investigacaoUrl: string | undefined;
  try {
    const { data: invRow, error: invErr } = await supabase
      .from("investigacoes")
      .insert({ ocorrencia_id: ocorrenciaRow.id, dados: EMPTY_DADOS, situacao: "em_andamento" })
      .select("token_publico")
      .single();
    if (invErr) throw invErr;
    investigacaoUrl = `${baseUrl}/investigacoes/editar/${invRow.token_publico}`;
  } catch (err: unknown) {
    await writeEvento(supabase, {
      tipoEntidade: "ocorrencia", entidadeId: ocorrenciaRow.id, evento: "email_enviado",
      dados: { investigacao_autocreate_failed: String(err) },
    });
  }
```

Then find the `ocorrencia-receipt` sendMail call (currently lines 156-176) and add `investigacao_url` to the payload:

```ts
    await sendMail({
      template: "ocorrencia-receipt",
      to: parsed.data.email_remetente,
      data: { o: {
        serial_id: ocorrenciaRow.serial_id,
        tipo: parsed.data.tipo,
        data_ocorrencia: parsed.data.data_ocorrencia,
        empresa_nome: ocorrenciaRow.empresas.nome,
        unidade_nome: ocorrenciaRow.unidades.nome,
        descricao: parsed.data.descricao ?? "",
        status_url: `${baseUrl}/ocorrencias/status/${ocorrenciaRow.token_edicao}`,
        investigacao_url: investigacaoUrl,
      } },
    });
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add emails/ocorrencia-receipt.ts app/api/public/ocorrencias/route.ts
git commit -m "$(cat <<'EOF'
feat(email): ocorrencia receipt — add 'Preencher investigação' CTA + capture token_publico

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Modify existing admin autosave to preserve em_aprovacao

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/app/api/ocorrencias/[id]/investigacao/route.ts`

- [ ] **Step 1: Update situacao handling**

Read the existing file. Find this block (around lines 31-48):

```ts
  const admin = getSupabaseAdmin();
  const targetSituacao = parsed.data.situacao ?? "em_andamento";

  const { data: row, error } = await admin
    .from("investigacoes")
    .upsert(
      { ocorrencia_id: id, dados: parsed.data.dados, situacao: targetSituacao },
      { onConflict: "ocorrencia_id" },
    )
    .select()
    .single();
```

Replace with:

```ts
  const admin = getSupabaseAdmin();

  // Determine target situacao. Admin save must preserve em_aprovacao (don't
  // drop the row out of the safety queue when the admin edits in place).
  // Otherwise default to em_andamento.
  const { data: existing } = await admin
    .from("investigacoes")
    .select("situacao")
    .eq("ocorrencia_id", id)
    .single();

  let targetSituacao: string;
  if (parsed.data.situacao === "finalizada") {
    // Legacy compat: callers passing "finalizada" go through aprovar endpoint instead.
    return NextResponse.json({ error: "use_aprovar_endpoint" }, { status: 410 });
  }
  if (parsed.data.situacao) {
    targetSituacao = parsed.data.situacao;
  } else if (existing?.situacao === "em_aprovacao") {
    targetSituacao = "em_aprovacao";
  } else if (existing?.situacao === "rejeitada") {
    targetSituacao = "rejeitada";
  } else {
    targetSituacao = "em_andamento";
  }

  const { data: row, error } = await admin
    .from("investigacoes")
    .upsert(
      { ocorrencia_id: id, dados: parsed.data.dados, situacao: targetSituacao },
      { onConflict: "ocorrencia_id" },
    )
    .select()
    .single();
```

Also remove the existing `finalizada` finalize-gate block (lines 22-29 — the `if (parsed.data.situacao === "finalizada") { try { assertFinalizable(...) } ... }`) and the trailing `if (targetSituacao === "finalizada") { await writeEvento(... investigacao_finalizada ...) }` block at the bottom. Approval now lives in the new dedicated route.

Update the `Body` zod schema at the top of the file:

```ts
const Body = z.object({
  dados:    InvestigacaoDadosSchema,
  situacao: z.enum(["em_andamento"]).optional(),  // public/admin draft saves only
});
```

(Drop the `"finalizada"` enum option since approval now goes through `/aprovar`.)

Update `ocorrenciaSituacao` derivation (around line 56) to remove `"finalizada"` reference:

```ts
  const dadosNonEmpty =
    parsed.data.dados.ishikawa.length +
    parsed.data.dados.plano_acao.length +
    parsed.data.dados.participantes.length +
    parsed.data.dados.fotos.length > 0;

  const ocorrenciaSituacao =
    targetSituacao === "em_aprovacao" || targetSituacao === "rejeitada"
      ? "em_investigacao"
      : (dadosNonEmpty ? "em_investigacao" : "aberta");
  await admin.from("ocorrencias").update({ situacao: ocorrenciaSituacao }).eq("id", id);
```

- [ ] **Step 2: Drop unused imports**

Remove the now-unused `assertFinalizable` import from this file. (It still exists in `lib/investigacao-dados.ts` — that's OK; we'll deprecate it later. Don't remove the definition.)

- [ ] **Step 3: Typecheck**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add app/api/ocorrencias/\[id\]/investigacao/route.ts
git commit -m "$(cat <<'EOF'
refactor(api): admin investigacao autosave preserves em_aprovacao/rejeitada; finalize moved to /aprovar

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Admin decision routes — aprovar, rejeitar, reabrir

**Files:**
- Create: `/Users/heizen/DEV/maia-app/emails/investigacao-aprovada.ts`
- Create: `/Users/heizen/DEV/maia-app/emails/investigacao-rejeitada.ts`
- Create: `/Users/heizen/DEV/maia-app/app/api/ocorrencias/[id]/investigacao/aprovar/route.ts`
- Create: `/Users/heizen/DEV/maia-app/app/api/ocorrencias/[id]/investigacao/rejeitar/route.ts`
- Create: `/Users/heizen/DEV/maia-app/app/api/ocorrencias/[id]/investigacao/reabrir/route.ts`
- Modify: `/Users/heizen/DEV/maia-app/lib/mail/send.ts`

- [ ] **Step 1: Write investigacao-aprovada email**

`/Users/heizen/DEV/maia-app/emails/investigacao-aprovada.ts`:

```ts
import { layout } from "./_layout";
import { recordTable } from "./_record-table";
import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";

export type InvestigacaoAprovadaEmail = {
  serial_id?: number | null;
  tipo: string;
  data_ocorrencia: string;
  empresa_nome: string;
  unidade_nome: string;
  decidido_por_nome?: string | null;
  decidido_em: string;
  relatorio_url: string;
};

export function investigacaoAprovada(data: { o: InvestigacaoAprovadaEmail }): string {
  const { o } = data;
  const idLabel = o.serial_id != null ? `#${o.serial_id}` : "";
  const body = `
    <p style="margin:16px 0;">A investigação <strong>${escapeHtml(idLabel)}</strong> foi aprovada${o.decidido_por_nome ? ` por ${escapeHtml(o.decidido_por_nome)}` : ""}.</p>
    ${recordTable([
      { label: "Identificador",  value: idLabel || "—" },
      { label: "Tipo",           value: o.tipo },
      { label: "Data",           value: o.data_ocorrencia },
      { label: "Empresa",        value: o.empresa_nome },
      { label: "Unidade",        value: o.unidade_nome },
      { label: "Aprovada em",    value: new Date(o.decidido_em).toLocaleString("pt-BR") },
    ])}
    <div style="margin-top:16px;">
      <a href="${escapeHtml(o.relatorio_url)}" style="display:inline-block;background:${EMAIL_COLORS.primary};color:${EMAIL_COLORS.primaryFg};padding:10px 16px;border-radius:6px;text-decoration:none;">Ver relatório</a>
    </div>
  `;
  return layout(`Investigação ${idLabel} concluída`, body);
}
```

- [ ] **Step 2: Write investigacao-rejeitada email**

`/Users/heizen/DEV/maia-app/emails/investigacao-rejeitada.ts`:

```ts
import { layout } from "./_layout";
import { recordTable } from "./_record-table";
import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";

export type InvestigacaoRejeitadaEmail = {
  serial_id?: number | null;
  tipo: string;
  data_ocorrencia: string;
  empresa_nome: string;
  unidade_nome: string;
  motivo: string;
  edit_url: string;
};

export function investigacaoRejeitada(data: { o: InvestigacaoRejeitadaEmail }): string {
  const { o } = data;
  const idLabel = o.serial_id != null ? `#${o.serial_id}` : "";
  const body = `
    <p style="margin:16px 0;">A investigação <strong>${escapeHtml(idLabel)}</strong> precisa de ajustes antes de ser aprovada.</p>
    <div style="background:${EMAIL_COLORS.dangerBg};padding:12px;border-radius:8px;margin-bottom:12px;">
      <p style="margin:0;font-size:12px;color:${EMAIL_COLORS.muted};text-transform:uppercase;letter-spacing:0.04em;">Motivo da rejeição</p>
      <p style="margin:8px 0 0;white-space:pre-wrap;">${escapeHtml(o.motivo)}</p>
    </div>
    ${recordTable([
      { label: "Identificador", value: idLabel || "—" },
      { label: "Tipo",          value: o.tipo },
      { label: "Data",          value: o.data_ocorrencia },
      { label: "Empresa",       value: o.empresa_nome },
      { label: "Unidade",       value: o.unidade_nome },
    ])}
    <div style="margin-top:16px;">
      <a href="${escapeHtml(o.edit_url)}" style="display:inline-block;background:${EMAIL_COLORS.primary};color:${EMAIL_COLORS.primaryFg};padding:10px 16px;border-radius:6px;text-decoration:none;">Editar investigação</a>
    </div>
  `;
  return layout(`Investigação ${idLabel} precisa de ajustes`, body);
}
```

- [ ] **Step 3: Register both templates in send.ts**

Edit `/Users/heizen/DEV/maia-app/lib/mail/send.ts`. Add imports:

```ts
import { investigacaoAprovada, type InvestigacaoAprovadaEmail } from "@/emails/investigacao-aprovada";
import { investigacaoRejeitada, type InvestigacaoRejeitadaEmail } from "@/emails/investigacao-rejeitada";
```

Add entries to TEMPLATES:

```ts
  "investigacao-aprovada": {
    subject: (data: { o: InvestigacaoAprovadaEmail }) => `Investigação${tagId(data.o.serial_id)} concluída`,
    render:  investigacaoAprovada,
  },
  "investigacao-rejeitada": {
    subject: (data: { o: InvestigacaoRejeitadaEmail }) => `Investigação${tagId(data.o.serial_id)} precisa de ajustes`,
    render:  investigacaoRejeitada,
  },
```

- [ ] **Step 4: Write the aprovar route**

`/Users/heizen/DEV/maia-app/app/api/ocorrencias/[id]/investigacao/aprovar/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { requireSafetyOrAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertSubmittable } from "@/lib/investigacao-step-gates";
import { writeEvento } from "@/lib/eventos";
import { sendMail } from "@/lib/mail/send";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

const APPROVABLE = new Set(["em_andamento", "em_aprovacao", "rejeitada"]);

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSafetyOrAdmin();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = getSupabaseAdmin();

  const { data: inv, error: invErr } = await admin
    .from("investigacoes")
    .select(`
      id, ocorrencia_id, situacao, dados, token_publico,
      ocorrencias!inner(
        id, serial_id, tipo, data_ocorrencia, email_remetente,
        empresas!inner(nome),
        unidades!inner(nome)
      )
    `)
    .eq("ocorrencia_id", id)
    .single();
  if (invErr || !inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!APPROVABLE.has(inv.situacao)) {
    return NextResponse.json({ error: "invalid_transition", from: inv.situacao }, { status: 409 });
  }

  try {
    assertSubmittable(inv.dados as InvestigacaoDados);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "incompleto" }, { status: 422 });
  }

  const now = new Date().toISOString();
  const { error: upErr } = await admin
    .from("investigacoes")
    .update({
      situacao:        "aprovada",
      decidido_por:    user.id,
      decidido_em:     now,
      motivo_rejeicao: null,
    })
    .eq("id", inv.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await admin.from("ocorrencias").update({ situacao: "concluida" }).eq("id", inv.ocorrencia_id);
  await writeEvento(admin, { tipoEntidade: "investigacao", entidadeId: inv.id, evento: "aprovado", autorId: user.id });

  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "";
  if (inv.ocorrencias.email_remetente) {
    const { data: u } = await admin.from("usuarios").select("nome").eq("id", user.id).single();
    try {
      await sendMail({
        template: "investigacao-aprovada",
        to: inv.ocorrencias.email_remetente,
        data: { o: {
          serial_id:         inv.ocorrencias.serial_id,
          tipo:              inv.ocorrencias.tipo,
          data_ocorrencia:   inv.ocorrencias.data_ocorrencia,
          empresa_nome:      inv.ocorrencias.empresas.nome,
          unidade_nome:      inv.ocorrencias.unidades.nome,
          decidido_por_nome: u?.nome ?? null,
          decidido_em:       now,
          relatorio_url:     `${baseUrl}/ocorrencias/relatorio/${inv.token_publico}`,
        } },
      });
      await writeEvento(admin, {
        tipoEntidade: "investigacao", entidadeId: inv.id,
        evento: "email_enviado", autorId: user.id, dados: { template: "investigacao-aprovada" },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await writeEvento(admin, {
        tipoEntidade: "investigacao", entidadeId: inv.id,
        evento: "email_enviado", autorId: user.id, dados: { template: "investigacao-aprovada", error: msg },
      });
    }
  }

  return NextResponse.json({ ok: true, relatorio_url: `${baseUrl}/ocorrencias/relatorio/${inv.token_publico}` });
}
```

- [ ] **Step 5: Write the rejeitar route**

`/Users/heizen/DEV/maia-app/app/api/ocorrencias/[id]/investigacao/rejeitar/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSafetyOrAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeEvento } from "@/lib/eventos";
import { sendMail } from "@/lib/mail/send";

const Body = z.object({ motivo_rejeicao: z.string().min(10) });

const REJECTABLE = new Set(["em_aprovacao", "rejeitada"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSafetyOrAdmin();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_motivo" }, { status: 400 });

  const { id } = await params;
  const admin = getSupabaseAdmin();

  const { data: inv, error: invErr } = await admin
    .from("investigacoes")
    .select(`
      id, ocorrencia_id, situacao, token_publico,
      ocorrencias!inner(
        serial_id, tipo, data_ocorrencia, email_remetente,
        empresas!inner(nome),
        unidades!inner(nome)
      )
    `)
    .eq("ocorrencia_id", id)
    .single();
  if (invErr || !inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!REJECTABLE.has(inv.situacao)) {
    return NextResponse.json({ error: "invalid_transition", from: inv.situacao }, { status: 409 });
  }

  const { error: upErr } = await admin
    .from("investigacoes")
    .update({
      situacao:        "rejeitada",
      decidido_por:    user.id,
      decidido_em:     new Date().toISOString(),
      motivo_rejeicao: parsed.data.motivo_rejeicao,
    })
    .eq("id", inv.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await admin.from("ocorrencias").update({ situacao: "em_investigacao" }).eq("id", inv.ocorrencia_id);
  await writeEvento(admin, {
    tipoEntidade: "investigacao", entidadeId: inv.id, evento: "rejeitado",
    autorId: user.id, dados: { motivo: parsed.data.motivo_rejeicao },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "";
  if (inv.ocorrencias.email_remetente) {
    try {
      await sendMail({
        template: "investigacao-rejeitada",
        to: inv.ocorrencias.email_remetente,
        data: { o: {
          serial_id:        inv.ocorrencias.serial_id,
          tipo:             inv.ocorrencias.tipo,
          data_ocorrencia:  inv.ocorrencias.data_ocorrencia,
          empresa_nome:     inv.ocorrencias.empresas.nome,
          unidade_nome:     inv.ocorrencias.unidades.nome,
          motivo:           parsed.data.motivo_rejeicao,
          edit_url:         `${baseUrl}/investigacoes/editar/${inv.token_publico}`,
        } },
      });
      await writeEvento(admin, {
        tipoEntidade: "investigacao", entidadeId: inv.id,
        evento: "email_enviado", autorId: user.id, dados: { template: "investigacao-rejeitada" },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await writeEvento(admin, {
        tipoEntidade: "investigacao", entidadeId: inv.id,
        evento: "email_enviado", autorId: user.id, dados: { template: "investigacao-rejeitada", error: msg },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Write the reabrir route**

`/Users/heizen/DEV/maia-app/app/api/ocorrencias/[id]/investigacao/reabrir/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { requireSafetyOrAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeEvento } from "@/lib/eventos";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSafetyOrAdmin();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = getSupabaseAdmin();

  const { data: inv, error: invErr } = await admin
    .from("investigacoes")
    .select("id, ocorrencia_id, situacao")
    .eq("ocorrencia_id", id)
    .single();
  if (invErr || !inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (inv.situacao !== "aprovada") {
    return NextResponse.json({ error: "invalid_transition", from: inv.situacao }, { status: 409 });
  }

  const { error: upErr } = await admin
    .from("investigacoes")
    .update({
      situacao:        "em_andamento",
      decidido_por:    null,
      decidido_em:     null,
      motivo_rejeicao: null,
      enviada_em:      null,
    })
    .eq("id", inv.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await admin.from("ocorrencias").update({ situacao: "em_investigacao" }).eq("id", inv.ocorrencia_id);
  await writeEvento(admin, { tipoEntidade: "investigacao", entidadeId: inv.id, evento: "criado", autorId: user.id, dados: { reabertura: true } });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Typecheck**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 8: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add emails/investigacao-aprovada.ts emails/investigacao-rejeitada.ts lib/mail/send.ts app/api/ocorrencias/\[id\]/investigacao/aprovar app/api/ocorrencias/\[id\]/investigacao/rejeitar app/api/ocorrencias/\[id\]/investigacao/reabrir
git commit -m "$(cat <<'EOF'
feat(api): investigacao decision routes (aprovar/rejeitar/reabrir) + 2 emails

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Decision action bar component for admin form

**Files:**
- Create: `/Users/heizen/DEV/maia-app/components/investigacoes/decision-action-bar.tsx`
- Modify: `/Users/heizen/DEV/maia-app/components/investigacoes/investigacao-form.tsx`
- Modify: `/Users/heizen/DEV/maia-app/app/(app)/ocorrencias/[id]/investigacao/page.tsx`

- [ ] **Step 1: Write the decision-action-bar component**

`/Users/heizen/DEV/maia-app/components/investigacoes/decision-action-bar.tsx`:

```tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  ocorrenciaId: string;
  situacao: string;
  tokenPublico: string;
  /** Called before any decision action: caller flushes pending edits to /investigacao route. */
  onBeforeAction: () => Promise<void>;
  busy: boolean;
  setBusy: (b: boolean) => void;
}

export function DecisionActionBar({
  ocorrenciaId, situacao, tokenPublico, onBeforeAction, busy, setBusy,
}: Props) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");

  const isReadOnly = situacao === "aprovada" || situacao === "cancelada";

  async function aprovar() {
    setBusy(true);
    try {
      await onBeforeAction();
      const res = await fetch(`/api/ocorrencias/${ocorrenciaId}/investigacao/aprovar`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      toast.success("Investigação aprovada.", {
        action: j.relatorio_url ? { label: "Ver relatório", onClick: () => window.open(j.relatorio_url, "_blank") } : undefined,
      });
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha ao aprovar.");
    } finally {
      setBusy(false);
    }
  }

  async function rejeitar() {
    if (motivo.trim().length < 10) {
      toast.error("O motivo precisa ter ao menos 10 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await onBeforeAction();
      const res = await fetch(`/api/ocorrencias/${ocorrenciaId}/investigacao/rejeitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo_rejeicao: motivo.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast.success("Investigação rejeitada.");
      setRejectOpen(false);
      setMotivo("");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha ao rejeitar.");
    } finally {
      setBusy(false);
    }
  }

  async function reabrir() {
    if (!confirm("Reabrir esta investigação? O status voltará para 'em andamento'.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ocorrencias/${ocorrenciaId}/investigacao/reabrir`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast.success("Investigação reaberta.");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha ao reabrir.");
    } finally {
      setBusy(false);
    }
  }

  const showRejeitar = situacao === "em_aprovacao" || situacao === "rejeitada";
  const showAprovar  = situacao === "em_andamento" || situacao === "em_aprovacao" || situacao === "rejeitada";
  const showReabrir  = situacao === "aprovada";
  const showRelatorio = situacao === "aprovada" || situacao === "em_aprovacao";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {showRelatorio && (
          <Link href={`/ocorrencias/relatorio/${tokenPublico}`} target="_blank">
            <Button type="button" variant="secondary">Ver relatório</Button>
          </Link>
        )}
        {showRejeitar && (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setRejectOpen(true)}>
            Rejeitar
          </Button>
        )}
        {showAprovar && (
          <Button type="button" disabled={busy} onClick={() => void aprovar()}>
            Aprovar
          </Button>
        )}
        {showReabrir && (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void reabrir()}>
            Reabrir
          </Button>
        )}
        {isReadOnly && !showReabrir && (
          <span className="text-sm text-[var(--color-fg-muted)]">Somente leitura.</span>
        )}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar investigação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--color-fg-muted)]">
            O motivo será enviado ao remetente da ocorrência por email. Mínimo 10 caracteres.
          </p>
          <textarea
            className="mt-2 w-full rounded-md border border-[var(--color-border)] p-2 text-sm"
            rows={5}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Descreva o que precisa ser ajustado."
          />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setRejectOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" disabled={busy} onClick={() => void rejeitar()}>
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

Verify the Dialog import path. Check what's available:

Run: `ls /Users/heizen/DEV/maia-app/components/ui/ 2>&1`
If `dialog.tsx` does not exist, use a simpler inline modal (a fixed-position div with backdrop). If a different modal primitive is exported (e.g., from `@base-ui/react`), adapt the import. The expected pattern in this codebase is shadcn-style dialog at `components/ui/dialog`.

- [ ] **Step 2: Wire the decision bar into the admin form**

Edit `/Users/heizen/DEV/maia-app/components/investigacoes/investigacao-form.tsx`. The current bottom-action `<div>` (lines 195-212) has "Voltar / Próximo / Salvar rascunho / Finalizar". Replace the right-side group (the "Salvar rascunho + Finalizar" pair) with `<DecisionActionBar>`. Pass:
- `ocorrenciaId={ocorrenciaId}` (already a prop)
- `situacao={initialSituacao}` (rename the existing `initialSituacao` prop to accept the expanded vocabulary — see Step 3 below)
- `tokenPublico={tokenPublico}` (new prop passed from the server page)
- `onBeforeAction={async () => { await persist("em_andamento"); }}` — flushes pending edits to the existing draft route before decision
- `busy={busy}` and `setBusy={setBusy}`

Update the interface:

```ts
interface Props {
  ocorrenciaId: string;
  initialDados: InvestigacaoDados;
  initialSituacao: "em_andamento" | "em_aprovacao" | "aprovada" | "rejeitada" | "cancelada";
  tokenPublico: string;
  categorias: Categoria[];
  graus:      Grau[];
  causasByCategoria: Record<string, Array<{ id: string; texto: string }>>;
}
```

Remove the old `persist("finalizada")` button. Keep `persist("em_andamento")` available as the "Salvar rascunho" button. The Decision bar calls `onBeforeAction` (which flushes the draft) before invoking aprovar/rejeitar/reabrir.

Add the import at top:
```ts
import { DecisionActionBar } from "./decision-action-bar";
```

Replace the right-side button group (the `<div className="flex gap-2">` containing "Salvar rascunho" and "Finalizar") with:

```tsx
<div className="flex flex-wrap items-center gap-2">
  <Button type="button" variant="secondary" disabled={busy} onClick={() => void persist("em_andamento")}>
    Salvar rascunho
  </Button>
  <DecisionActionBar
    ocorrenciaId={ocorrenciaId}
    situacao={initialSituacao}
    tokenPublico={tokenPublico}
    onBeforeAction={async () => { await persist("em_andamento"); }}
    busy={busy}
    setBusy={setBusy}
  />
</div>
```

Note: `persist` currently sends `situacao: "em_andamento" | "finalizada"` to the route. Update the function signature to `situacao: "em_andamento"` only (drop the `"finalizada"` overload), matching the route change from Task 10:

```ts
async function persist(situacao: "em_andamento") { ... }
```

And remove the `if (situacao === "finalizada") { router.push(...) } else { router.refresh(); }` branch — replace with just `router.refresh()`.

- [ ] **Step 3: Pass tokenPublico from server page**

Edit `/Users/heizen/DEV/maia-app/app/(app)/ocorrencias/[id]/investigacao/page.tsx`. The select needs to fetch `token_publico, situacao` from the related investigation row. Update:

```ts
supabase
  .from("ocorrencias")
  .select("id, tipo, situacao, data_ocorrencia, investigacoes(id, situacao, dados, token_publico)")
  .eq("id", id)
  .single(),
```

And the OcorrenciaSummary type:

```ts
interface OcorrenciaSummary {
  id: string;
  tipo: string;
  situacao: string;
  data_ocorrencia: string;
  investigacoes: {
    id: string;
    situacao: "em_andamento" | "em_aprovacao" | "aprovada" | "rejeitada" | "cancelada";
    dados: InvestigacaoDados | null;
    token_publico: string;
  }[] | null;
}
```

Pass token to InvestigacaoForm:

```tsx
<InvestigacaoForm
  ocorrenciaId={row.id}
  initialDados={initialDados}
  initialSituacao={initialSituacao}
  tokenPublico={inv?.token_publico ?? ""}
  categorias={categorias ?? []}
  graus={graus ?? []}
  causasByCategoria={causasByCategoria}
/>
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit`
Expected: EXIT 0. Address any remaining usages of `"finalizada"` literal (e.g., `<InvestigationStatus>` may still reference it — replace with `"aprovada"`).

- [ ] **Step 5: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add components/investigacoes/decision-action-bar.tsx components/investigacoes/investigacao-form.tsx app/\(app\)/ocorrencias/\[id\]/investigacao/page.tsx
git commit -m "$(cat <<'EOF'
feat(investigacao): admin decision action bar with situacao-aware buttons + reject modal

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: InvestigacaoReport component

**Files:**
- Create: `/Users/heizen/DEV/maia-app/components/investigacoes/investigacao-report.tsx`

- [ ] **Step 1: Write the component**

```tsx
import type { InvestigacaoDados } from "@/lib/investigacao-dados";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";
import { investigacaoSituacaoLabel } from "@/lib/investigacao-state";
import { planoAcaoStatusLabel } from "@/lib/investigacao-state";

interface Props {
  ocorrencia: {
    serial_id: number | null;
    tipo: string;
    data_ocorrencia: string;
    descricao: string | null;
    colaborador_nome: string | null;
    cpf: string | null;
    colaborador_setor: string | null;
    colaborador_cargo: string | null;
    tipo_local: string | null;
    texto_local: string | null;
    atendimento: boolean;
    data_atendimento: string | null;
    hora_atendimento: string | null;
    duracao_afastamento: number | null;
    cid: string | null;
    parecer_medico: string | null;
    internacao: boolean;
    morte: boolean;
    bo: boolean;
    no_bo: string | null;
    empresa_nome: string;
    unidade_nome: string;
    empresa_logo_url?: string | null;
  };
  investigacao: {
    situacao: string;
    dados: InvestigacaoDados;
    decidido_por_nome?: string | null;
    decidido_em?: string | null;
    token_publico: string;
  };
  categoriasById: Record<string, { rotulo: string; codigo: string }>;
  grausById: Record<string, { rotulo: string }>;
  publicReportUrl: string;
  storagePublicBase: string;  // ${SUPABASE_URL}/storage/v1/object/public/attachments/
}

export function InvestigacaoReport({
  ocorrencia, investigacao, categoriasById, grausById, publicReportUrl, storagePublicBase,
}: Props) {
  const { dados } = investigacao;
  const idLabel = ocorrencia.serial_id != null ? `#${ocorrencia.serial_id}` : "—";

  const ishikawaFilled = dados.ishikawa.filter((b) => b.causas.length > 0);

  return (
    <article className="report mx-auto max-w-3xl bg-white p-8 text-[var(--color-fg)] print:p-0">
      {/* 1. Header */}
      <header className="mb-6 border-b border-[var(--color-border)] pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-fg-muted)]">Relatório de investigação</p>
            <h1 className="mt-1 text-2xl font-semibold">{ocorrencia.empresa_nome}</h1>
            <p className="text-sm text-[var(--color-fg-muted)]">{ocorrencia.unidade_nome}</p>
          </div>
          {ocorrencia.empresa_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ocorrencia.empresa_logo_url} alt="" className="h-12 w-auto" />
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div><span className="text-[var(--color-fg-muted)]">Identificador:</span> <strong>{idLabel}</strong></div>
          <div><span className="text-[var(--color-fg-muted)]">Tipo:</span> {ocorrenciaTipoLabel(ocorrencia.tipo)}</div>
          <div><span className="text-[var(--color-fg-muted)]">Data:</span> {new Date(ocorrencia.data_ocorrencia).toLocaleString("pt-BR")}</div>
          <div><span className="text-[var(--color-fg-muted)]">Situação:</span> {investigacaoSituacaoLabel(investigacao.situacao)}</div>
          {investigacao.situacao === "aprovada" && investigacao.decidido_por_nome ? (
            <div><span className="text-[var(--color-fg-muted)]">Aprovada por:</span> {investigacao.decidido_por_nome}{investigacao.decidido_em ? ` em ${new Date(investigacao.decidido_em).toLocaleString("pt-BR")}` : ""}</div>
          ) : null}
        </div>
      </header>

      {/* 2. Resumo da ocorrência */}
      <Section title="Resumo da ocorrência">
        <Fields fields={[
          { label: "Colaborador", value: ocorrencia.colaborador_nome ?? "—" },
          { label: "CPF",         value: ocorrencia.cpf ?? "—" },
          { label: "Setor",       value: ocorrencia.colaborador_setor ?? "—" },
          { label: "Cargo",       value: ocorrencia.colaborador_cargo ?? "—" },
          { label: "Tipo de local", value: ocorrencia.tipo_local ?? "—" },
          { label: "Local",       value: ocorrencia.texto_local ?? "—" },
        ]} />
        {ocorrencia.descricao ? (
          <p className="mt-3 whitespace-pre-wrap text-sm">{ocorrencia.descricao}</p>
        ) : null}
      </Section>

      {/* 3. Atendimento médico (conditional) */}
      {ocorrencia.atendimento ? (
        <Section title="Atendimento médico">
          <Fields fields={[
            { label: "Data",                value: ocorrencia.data_atendimento ?? "—" },
            { label: "Hora",                value: ocorrencia.hora_atendimento ?? "—" },
            { label: "Duração afastamento", value: ocorrencia.duracao_afastamento != null ? `${ocorrencia.duracao_afastamento} dias` : "—" },
            { label: "CID",                 value: ocorrencia.cid ?? "—" },
            { label: "Internação",          value: ocorrencia.internacao ? "Sim" : "Não" },
            { label: "Morte",               value: ocorrencia.morte ? "Sim" : "Não" },
            { label: "BO",                  value: ocorrencia.bo ? `Sim${ocorrencia.no_bo ? ` (${ocorrencia.no_bo})` : ""}` : "Não" },
          ]} />
          {ocorrencia.parecer_medico ? (
            <div className="mt-3">
              <p className="text-xs uppercase text-[var(--color-fg-muted)]">Parecer médico</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{ocorrencia.parecer_medico}</p>
            </div>
          ) : null}
        </Section>
      ) : null}

      {/* 4. Análise Ishikawa */}
      {ishikawaFilled.length > 0 ? (
        <Section title="Análise Ishikawa">
          <div className="grid gap-3 sm:grid-cols-2">
            {ishikawaFilled.map((b) => {
              const cat = categoriasById[b.categoria_id];
              const grau = b.grau_id ? grausById[b.grau_id] : null;
              return (
                <div key={b.categoria_id} className="rounded-md border border-[var(--color-border)] p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{cat?.rotulo ?? "Categoria"}</h3>
                    {grau ? <span className="rounded-md bg-[var(--color-bg-muted)] px-2 py-0.5 text-xs">{grau.rotulo}</span> : null}
                  </div>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {b.causas.map((c, i) => <li key={i}>{c.descricao}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      {/* 5. Plano de ação */}
      {dados.plano_acao.length > 0 ? (
        <Section title="Plano de ação">
          <table className="w-full border-collapse text-sm">
            <thead className="text-left text-xs uppercase text-[var(--color-fg-muted)]">
              <tr>
                <th className="border-b border-[var(--color-border)] py-2 pr-3">Ação</th>
                <th className="border-b border-[var(--color-border)] py-2 pr-3">Responsável</th>
                <th className="border-b border-[var(--color-border)] py-2 pr-3">Prazo</th>
                <th className="border-b border-[var(--color-border)] py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {dados.plano_acao.map((a, i) => (
                <tr key={i}>
                  <td className="border-b border-[var(--color-border)] py-2 pr-3">{a.acao}</td>
                  <td className="border-b border-[var(--color-border)] py-2 pr-3">{a.responsavel}</td>
                  <td className="border-b border-[var(--color-border)] py-2 pr-3">{a.prazo}</td>
                  <td className="border-b border-[var(--color-border)] py-2">{planoAcaoStatusLabel(a.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {/* 6. Participantes */}
      {dados.participantes.length > 0 ? (
        <Section title="Participantes">
          <ul className="text-sm">
            {dados.participantes.map((p, i) => (
              <li key={i} className="border-b border-[var(--color-border)] py-1">
                {p.nome}{p.email ? <span className="text-[var(--color-fg-muted)]"> · {p.email}</span> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* 7. Galeria de fotos */}
      {dados.fotos.length > 0 ? (
        <Section title="Galeria de fotos">
          <div className="grid grid-cols-2 gap-3">
            {dados.fotos.map((f, i) => (
              <figure key={i} className="overflow-hidden rounded-md border border-[var(--color-border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${storagePublicBase}${f.path}`} alt={f.legenda ?? ""} className="w-full" />
                {f.legenda ? <figcaption className="p-2 text-xs text-[var(--color-fg-muted)]">{f.legenda}</figcaption> : null}
              </figure>
            ))}
          </div>
        </Section>
      ) : null}

      {/* 8. Footer */}
      <footer className="mt-8 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-fg-muted)]">
        Relatório gerado em {new Date().toLocaleString("pt-BR")} · Permalink: <span className="font-mono">{publicReportUrl}</span>
      </footer>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">{title}</h2>
      {children}
    </section>
  );
}

function Fields({ fields }: { fields: Array<{ label: string; value: string }> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
      {fields.map((f) => (
        <React.Fragment key={f.label}>
          <dt className="text-[var(--color-fg-muted)]">{f.label}</dt>
          <dd>{f.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
```

Add the React import at the top:
```ts
import * as React from "react";
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add components/investigacoes/investigacao-report.tsx
git commit -m "$(cat <<'EOF'
feat(investigacao): InvestigacaoReport component (8-section code-rendered report)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Public report page

**Files:**
- Create: `/Users/heizen/DEV/maia-app/app/(public)/ocorrencias/relatorio/[token]/page.tsx`
- Create: `/Users/heizen/DEV/maia-app/app/(public)/ocorrencias/relatorio/[token]/print.css` (imported via CSS module or globals)

- [ ] **Step 1: Write the report page**

```tsx
import { notFound, redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { InvestigacaoReport } from "@/components/investigacoes/investigacao-report";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

const VIEWABLE = new Set(["em_aprovacao", "aprovada"]);

export default async function RelatorioPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: inv } = await supabase
    .from("investigacoes")
    .select(`
      id, situacao, dados, decidido_em, token_publico, decidido_por,
      ocorrencias!inner(
        serial_id, tipo, data_ocorrencia, descricao,
        colaborador_nome, cpf, colaborador_setor, colaborador_cargo,
        tipo_local, texto_local,
        atendimento, data_atendimento, hora_atendimento,
        duracao_afastamento, cid, parecer_medico,
        internacao, morte, bo, no_bo,
        empresas!inner(nome, logo_url),
        unidades!inner(nome)
      )
    `)
    .eq("token_publico", token)
    .single();

  if (!inv) notFound();
  if (!VIEWABLE.has(inv.situacao)) {
    redirect(`/investigacoes/editar/${inv.token_publico}`);
  }

  const [{ data: categorias }, { data: graus }] = await Promise.all([
    supabase.from("investigacao_categorias").select("id, codigo, rotulo"),
    supabase.from("investigacao_graus").select("id, rotulo"),
  ]);

  const categoriasById: Record<string, { rotulo: string; codigo: string }> = {};
  for (const c of (categorias ?? [])) categoriasById[c.id] = { rotulo: c.rotulo, codigo: c.codigo };
  const grausById: Record<string, { rotulo: string }> = {};
  for (const g of (graus ?? [])) grausById[g.id] = { rotulo: g.rotulo };

  let decididoPorNome: string | null = null;
  if (inv.decidido_por) {
    const { data: u } = await supabase.from("usuarios").select("nome").eq("id", inv.decidido_por).single();
    decididoPorNome = u?.nome ?? null;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const o = inv.ocorrencias;

  return (
    <div className="min-h-screen bg-[var(--color-bg-muted)] py-6 print:bg-white print:py-0">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 pb-4 print:hidden">
        <a
          href={`/api/public/investigacoes/${inv.token_publico}/pdf`}
          className="rounded-md bg-[var(--brand-primary-600)] px-4 py-2 text-sm font-medium text-white"
        >
          Baixar PDF
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm"
        >
          Imprimir
        </button>
      </div>
      <InvestigacaoReport
        ocorrencia={{
          serial_id:           o.serial_id,
          tipo:                o.tipo,
          data_ocorrencia:     o.data_ocorrencia,
          descricao:           o.descricao,
          colaborador_nome:    o.colaborador_nome,
          cpf:                 o.cpf,
          colaborador_setor:   o.colaborador_setor,
          colaborador_cargo:   o.colaborador_cargo,
          tipo_local:          o.tipo_local,
          texto_local:         o.texto_local,
          atendimento:         o.atendimento,
          data_atendimento:    o.data_atendimento,
          hora_atendimento:    o.hora_atendimento,
          duracao_afastamento: o.duracao_afastamento,
          cid:                 o.cid,
          parecer_medico:      o.parecer_medico,
          internacao:          o.internacao,
          morte:               o.morte,
          bo:                  o.bo,
          no_bo:               o.no_bo,
          empresa_nome:        o.empresas.nome,
          unidade_nome:        o.unidades.nome,
          empresa_logo_url:    (o.empresas as { logo_url?: string | null }).logo_url ?? null,
        }}
        investigacao={{
          situacao:           inv.situacao,
          dados:              (inv.dados ?? { ishikawa: [], plano_acao: [], participantes: [], fotos: [] }) as InvestigacaoDados,
          decidido_por_nome:  decididoPorNome,
          decidido_em:        inv.decidido_em,
          token_publico:      inv.token_publico,
        }}
        categoriasById={categoriasById}
        grausById={grausById}
        publicReportUrl={`${baseUrl}/ocorrencias/relatorio/${inv.token_publico}`}
        storagePublicBase={`${supabaseUrl}/storage/v1/object/public/attachments/`}
      />
    </div>
  );
}
```

Two notes for the implementing engineer:
1. The "Imprimir" button uses `window.print()` and `onClick` — this requires the surrounding markup to be a client component for that single button, OR to wrap the buttons in a small client component. The cleanest approach: extract the button row into `/Users/heizen/DEV/maia-app/app/(public)/ocorrencias/relatorio/[token]/print-controls.tsx` as a `"use client"` component, then render `<PrintControls tokenPublico={inv.token_publico} />` from the server page. Do that here.

2. If `empresas.logo_url` doesn't exist in the schema (verify by grepping `lib/supabase/database.types.ts`), drop the logo_url select and prop — make it optional in `<InvestigacaoReport>` (already is). The component handles `null`.

- [ ] **Step 2: Create the PrintControls client component**

`/Users/heizen/DEV/maia-app/app/(public)/ocorrencias/relatorio/[token]/print-controls.tsx`:

```tsx
"use client";
import { Button } from "@/components/ui/button";

interface Props { tokenPublico: string; }

export function PrintControls({ tokenPublico }: Props) {
  return (
    <div className="mx-auto flex max-w-3xl items-center justify-between px-4 pb-4 print:hidden">
      <a
        href={`/api/public/investigacoes/${tokenPublico}/pdf`}
        className="rounded-md bg-[var(--brand-primary-600)] px-4 py-2 text-sm font-medium text-white"
      >
        Baixar PDF
      </a>
      <Button type="button" variant="secondary" onClick={() => window.print()}>
        Imprimir
      </Button>
    </div>
  );
}
```

Update the server page to import and use `<PrintControls />` instead of the inline button row.

- [ ] **Step 3: Typecheck**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add app/\(public\)/ocorrencias/relatorio
git commit -m "$(cat <<'EOF'
feat(investigacao): public report page at /ocorrencias/relatorio/[token]

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: PDF route via puppeteer-core + @sparticuz/chromium

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/package.json` (add deps)
- Create: `/Users/heizen/DEV/maia-app/app/api/public/investigacoes/[token]/pdf/route.ts`

- [ ] **Step 1: Add dependencies**

Run:
```bash
cd /Users/heizen/DEV/maia-app
npm install puppeteer-core @sparticuz/chromium
```
Expected: both added to `dependencies` in package.json. `@sparticuz/chromium` ships a Lambda/Vercel-compatible Chromium binary.

- [ ] **Step 2: Write the PDF route**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VIEWABLE = new Set(["em_aprovacao", "aprovada"]);

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const admin = getSupabaseAdmin();
  const { data: inv, error } = await admin
    .from("investigacoes")
    .select("id, situacao")
    .eq("token_publico", token)
    .single();
  if (error || !inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!VIEWABLE.has(inv.situacao)) {
    return NextResponse.json({ error: "not_viewable", situacao: inv.situacao }, { status: 409 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  const reportUrl = `${baseUrl}/ocorrencias/relatorio/${token}`;

  const isDev = process.env.NODE_ENV === "development";

  // Conditional import: in dev we'd use full puppeteer if installed, but to keep
  // a single dep we use puppeteer-core + @sparticuz/chromium in all environments.
  const chromium = (await import("@sparticuz/chromium")).default;
  const puppeteer = await import("puppeteer-core");

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless as unknown as boolean,
    defaultViewport: { width: 1240, height: 1754 },
  });

  try {
    const page = await browser.newPage();
    await page.goto(reportUrl, { waitUntil: "networkidle0", timeout: 30000 });
    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="investigacao-${token}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 3: Local dev note**

For local development, `@sparticuz/chromium` works but is heavyweight. If the developer hits issues, they can use `puppeteer` (full package, includes Chromium for the platform) by installing it as a dev dependency and conditionally switching when `isDev`. Out of scope for this task — flag in a comment if you hit it.

- [ ] **Step 4: Typecheck**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 5: Smoke test (manual)**

Run dev server: `cd /Users/heizen/DEV/maia-app && npm run dev`. In another terminal: submit a public ocorrência through `/forms/ocorrencias`, follow the email's investigation link, fill the four steps, submit. Then login as admin (or open the report token directly: `curl -I http://localhost:3000/api/public/investigacoes/<token>/pdf`). Expected: 200 with `Content-Type: application/pdf`. If chromium fails to launch locally, see Step 3.

- [ ] **Step 6: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add package.json package-lock.json app/api/public/investigacoes/\[token\]/pdf
git commit -m "$(cat <<'EOF'
feat(api): server-rendered investigation PDF via puppeteer-core + @sparticuz/chromium

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Wire admin "Ver relatório" link into the detail page + post-approve flow

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/app/(app)/ocorrencias/[id]/page.tsx`
- Modify: `/Users/heizen/DEV/maia-app/components/investigacoes/investigation-status.tsx`

- [ ] **Step 1: Update investigation-status to point to the report when aprovada**

The current component (`components/investigacoes/investigation-status.tsx`) shows InvestigacaoSummary when finalizada (now `aprovada`). Replace the InvestigacaoSummary "Ver investigação" link to also offer "Ver relatório" once aprovada:

Read the file to find the exact structure. Add to the props:

```ts
interface Props {
  ocorrenciaId: string;
  investigacao: {
    situacao: "em_andamento" | "em_aprovacao" | "aprovada" | "rejeitada" | "cancelada";
    dados: InvestigacaoDados | null;
    token_publico?: string | null;
  } | null;
}
```

When `investigacao?.situacao === "aprovada"`, render the InvestigacaoSummary block PLUS a `<Link href={`/ocorrencias/relatorio/${investigacao.token_publico}`} target="_blank">Ver relatório</Link>` button beside the "Ver investigação" button.

When `situacao === "em_aprovacao"`, show a status card: "Aguardando aprovação. Revisar agora →" linking to `/ocorrencias/[id]/investigacao`.

When `situacao === "rejeitada"`, show a status card with the motivo (truncated) + link.

- [ ] **Step 2: Pass token_publico from the detail page**

Edit `/Users/heizen/DEV/maia-app/app/(app)/ocorrencias/[id]/page.tsx`. Update the investigacoes select to include `token_publico`:

```ts
.select("*, empresas!inner(nome), unidades!inner(nome), investigacoes(id, situacao, dados, token_publico)")
```

Update the type:

```ts
type OcorrenciaWithInvestigacoes = OcorrenciaFull & {
  investigacoes: {
    id: string;
    situacao: "em_andamento" | "em_aprovacao" | "aprovada" | "rejeitada" | "cancelada";
    dados: InvestigacaoDados | null;
    token_publico: string;
  }[] | null;
};
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add app/\(app\)/ocorrencias/\[id\]/page.tsx components/investigacoes/investigation-status.tsx
git commit -m "$(cat <<'EOF'
feat(investigacao): wire 'Ver relatório' on detail page + situacao-aware status card

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Full regression typecheck + vitest run + lint

- [ ] **Step 1: Run the full test suite**

Run: `cd /Users/heizen/DEV/maia-app && npx vitest run`
Expected: all unit tests pass. If any fail, address inline before proceeding.

- [ ] **Step 2: Typecheck the whole project**

Run: `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 3: Lint**

Run: `cd /Users/heizen/DEV/maia-app && npm run lint`
Expected: EXIT 0. Address any warnings introduced by this plan.

- [ ] **Step 4: Manual end-to-end smoke**

In dev:
1. POST `/forms/ocorrencias` with `atendimento=false`. Verify receipt email contains both CTAs.
2. Follow "Preencher investigação" link. Fill Ishikawa (1 cause) → confirm Avançar enables. Fill Plano (1 item) → enable Avançar. Add Participante → enable Avançar. Skip fotos → "Enviar para aprovação" becomes available. Submit.
3. Verify safety team gets `investigacao-em-aprovacao`. Investigation now `em_aprovacao`.
4. Open admin `/ocorrencias/[id]/investigacao`. Click "Rejeitar", enter motivo (≥10 chars), confirm.
5. Verify submitter gets `investigacao-rejeitada` with motivo. Public link reopens. Edit, re-submit.
6. Back in admin, click "Aprovar". Verify submitter gets `investigacao-aprovada` with report URL.
7. Open the report URL — preview renders. Click "Baixar PDF" — PDF downloads.
8. Click "Reabrir" — situacao back to `em_andamento`, decision fields cleared.

- [ ] **Step 5: Final commit (only if any cleanup was needed)**

If steps 1-4 surfaced cleanup, commit those fixes:

```bash
cd /Users/heizen/DEV/maia-app
git add -A
git commit -m "$(cat <<'EOF'
chore: regression cleanup after investigacao flow rollout

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Plan Summary

- **Migrations:** 1 (`022_investigacoes_workflow.sql`)
- **New files:** 16
- **Modified files:** 9
- **New tests:** 2 (step-gate module, status-pill new domain)
- **Commits:** ~16 (one per task)
- **End-to-end milestone:** after Task 9, the email→public-form→submit→safety-email loop is fully working. Tasks 10-16 add admin decisions, the report, and the PDF.

## Spec-coverage map

| Spec section | Covered by task(s) |
|---|---|
| 3. Data model | Task 1 |
| 4. Step-gate module | Task 2 |
| 5.1 Public routes | Tasks 4, 5, 6, 7, 8, 14, 15 |
| 5.2 Admin routes | Tasks 10, 11 |
| 5.3 Modified create route | Task 9 |
| 6. Public form UX | Tasks 4, 5 |
| 7. Admin form UX | Task 12 |
| 8. Emails | Tasks 8, 9, 11 |
| 9. Report renderer | Tasks 13, 14 |
| 10. PDF route | Task 15 |
| Status pill / vocabulary | Task 3 |
| Detail-page integration | Task 16 |
| Regression | Task 17 |
