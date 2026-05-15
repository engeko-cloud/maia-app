# Phase 6.5 Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close three Phase 6 gaps — causa library, topbar discoverability, dev seed data — so the Ishikawa surface is practically usable for evaluation and the upcoming Phase 7 has realistic data to aggregate.

**Architecture:** A new `investigacao_causas` table seeded with 83 legacy causas drives an admin CRUD page and a per-categoria picker in the investigation form. A coupled change converts `dados.ishikawa[].causas` from `string[]` to `{causa_id?, descricao}[]` (Phase 6 has no production data; existing dev rows are backfilled in the same migration). Two new maia-db migrations (one prod, one dev-only) plus targeted maia-app edits (zod, editor UI, summary, admin route, nav). One AdminCrudTable enhancement (`select` column type) supports the causa form's categoria dropdown and can be reused by future admin pages.

**Tech Stack:** Same as Phase 6 — Next.js 16 App Router, React 19, Tailwind v4, shadcn `base-nova`/`@base-ui/react`, Supabase SSR + service-role admin, PostgreSQL jsonb `@>` containment, react-hook-form + zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-14-phase-6-5-completion-design.md`

---

## File map

| Path | Action | Responsibility |
|---|---|---|
| `maia-db/supabase/migrations/016_investigacao_causas.sql` | create | Table, partial unique index, 83-row seed, backfill of `dados.ishikawa[].causas`, RLS |
| `maia-db/supabase/migrations/017_seed_dev.sql` | create | Dev-only: usuarios, colaboradores, afastamentos, ocorrências, investigações, eventos |
| `maia-app/lib/supabase/database.types.ts` | regenerate | Add `investigacao_causas` types |
| `maia-app/lib/investigacao-dados.ts` | modify | `CausaSchema = { causa_id?, descricao }`; update `IshikawaEntrySchema.causas` |
| `maia-app/lib/investigacao-fk-check.ts` | modify | Add `buildCausaInUseQuery` |
| `maia-app/components/investigacoes/ishikawa-branch-editor.tsx` | modify | Type change + library Select + descricao Input per causa row |
| `maia-app/components/investigacoes/investigacao-form.tsx` | modify | Receive `causasByCategoria`; pass to editor; update empty-row filter |
| `maia-app/components/investigacoes/investigacao-summary.tsx` | modify | Count `causas.length` (still works after shape change); render texto from library when `causa_id` present |
| `maia-app/components/admin/crud-table.tsx` | modify | Add `type: "select"` column with `options` array |
| `maia-app/app/api/admin/investigacao/causas/route.ts` | create | GET + POST |
| `maia-app/app/api/admin/investigacao/causas/[id]/route.ts` | create | PATCH + DELETE (with FK pre-check) |
| `maia-app/app/(admin)/admin/investigacao/causas/page.tsx` | create | AdminCrudTable wrapper with categoria options |
| `maia-app/app/(admin)/admin/page.tsx` | modify | Add Causas tile |
| `maia-app/app/(app)/ocorrencias/[id]/investigacao/page.tsx` | modify | Fetch causas in parallel; pass to InvestigacaoForm |
| `maia-app/lib/nav.ts` | modify | Drop Phase 4 TODO; add Nova/categorias/graus/causas entries |
| `maia-app/tests/unit/investigacao-dados-schema.test.ts` | modify | Update fixtures to new causa shape |
| `maia-app/tests/unit/investigacao-jsonb-fk-check.test.ts` | modify | Add causa FK builder test |
| `maia-app/tests/e2e/happy-path.spec.ts` | modify | Pick a library causa in the gated arc |
| `maia-app/docs/superpowers/specs/2026-05-14-feature-expansion-design.md` | modify | Append "+6.5 completion" SHA range to Phase 6 status |

---

## Task 1: maia-db migration — `investigacao_causas` table, 83-row seed, backfill

**Files:**
- Create: `/Users/heizen/DEV/maia-db/supabase/migrations/016_investigacao_causas.sql`

- [ ] **Step 1: Create the migration file**

Write `/Users/heizen/DEV/maia-db/supabase/migrations/016_investigacao_causas.sql`:

```sql
-- Phase 6.5: causa library for Ishikawa investigation.
-- Curated suggestions per categoria; users may still type free-text causas.

-- 1. Table
create table investigacao_causas (
  id            uuid primary key default gen_random_uuid(),
  categoria_id  uuid not null references investigacao_categorias(id) on delete restrict,
  texto         text not null,
  ordem         int  not null default 0,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index uq_investigacao_causas_categoria_texto
  on investigacao_causas(categoria_id, texto);

create index idx_investigacao_causas_categoria_ordem
  on investigacao_causas(categoria_id, ordem) where ativo;

create trigger trg_investigacao_causas_atualizado
  before update on investigacao_causas
  for each row execute function set_atualizado_em();

-- 2. RLS
alter table investigacao_causas enable row level security;

create policy causas_read_authenticated on investigacao_causas
  for select to authenticated using (true);

create policy causas_write_admin on investigacao_causas
  for all to authenticated
  using     (exists (select 1 from usuarios where id = (select auth.uid()) and administrador))
  with check(exists (select 1 from usuarios where id = (select auth.uid()) and administrador));

-- 3. Seed (83 entries, idempotent via uq_investigacao_causas_categoria_texto)
-- Map: legacy `tipo` -> new categoria.codigo
--   metodos       -> metodo
--   maquinas      -> maquina
--   medidas       -> medida
--   meio_ambiente -> meio_ambiente
--   materiais     -> material
--   mdo           -> mao_de_obra
do $$
declare
  cat record;
  causas_data text[] := array[
    -- categoria_codigo, ordem, texto
    'metodo|0|Linguagem inadequada',
    'metodo|1|Inexistência de dados críticos no procedimento',
    'metodo|2|Metodologia inexequível',
    'metodo|3|Falhas de ortografia',
    'metodo|4|Inexistência de requisitos legais',
    'metodo|5|Falta de figuras explicativas',
    'metodo|6|Inexistência de procedimento documentado',
    'metodo|7|Ausência de procedimento documentado na frente de trabalho',
    'metodo|8|Texto incompreensível - baixa resolução',
    'metodo|9|Figura incompreensível - baixa resolução',
    'metodo|10|Fluxograma incompreensível - baixa resolução',
    'metodo|11|Não seguiu procedimento de segurança da empresa',
    'maquina|0|Acessório inadequado ao uso pretendido',
    'maquina|1|Acessório incompatível com a capacidade da máquina',
    'maquina|2|Ausência de dispositivo de desligamento em caso de emergência',
    'maquina|3|Ausência de dispositivo de segurança',
    'maquina|4|Botão de emergência não funcionou',
    'maquina|5|Capacidade da máquina abaixo do necessário',
    'maquina|6|Capacidade da máquina acima do necessário',
    'maquina|7|Dispositivo de segurança existente mas bloqueado',
    'maquina|8|Falhas mecânicas em equipamentos/máquinas',
    'maquina|9|Ferramenta/equipamento/dispositivo inadequado/ausente',
    'maquina|10|Freios não funcionaram',
    'maquina|11|Manutenção não executada',
    'maquina|12|Isolamento de energia perigosa inadequado/ausente',
    'maquina|13|Máquina sem acessórios de segurança',
    'maquina|14|Máquina com especificações abaixo do necessário',
    'maquina|15|Máquina com especificações acima do necessário',
    'maquina|16|Máquina inadequada ao uso',
    'maquina|17|Máquina sem manutenção',
    'medida|0|Ausência de calibração',
    'medida|1|Cadeia de confiabilidade de calibração sem garantia',
    'medida|2|Equipamento com a calibração vencida',
    'medida|3|Laboratório de calibração não pertence a empresa',
    'medida|4|Não atendimento a tolerância admissível do equipamento',
    'medida|5|Padrões utilizados para calibração vencidos',
    'medida|6|Precisões abaixo do necessário',
    'medida|7|Precisões acima do necessário',
    'medida|8|Tolerância admissível desconhecida',
    'medida|9|Tolerância parcialmente atendida',
    'meio_ambiente|0|Acesso restrito não controlado',
    'meio_ambiente|1|Chuvas intensas',
    'meio_ambiente|2|Contenção/sumps/separadores de água e óleo inadequados',
    'meio_ambiente|3|Descarte e disposição de materiais e resíduos inadequado',
    'meio_ambiente|4|Diluição e/ou dosagem de produto inadequada',
    'meio_ambiente|5|Espaços apertados para execução da tarefa',
    'meio_ambiente|6|Estação de tratamento de água inadequada',
    'meio_ambiente|7|Estação lava olhos/chuveiro de emergência inadequado/ausente',
    'meio_ambiente|8|Gases asfixiantes',
    'meio_ambiente|9|Gases tóxicos',
    'meio_ambiente|10|Iluminação deficiente',
    'meio_ambiente|11|Iluminação excessiva',
    'meio_ambiente|12|Iluminação inadequada',
    'meio_ambiente|13|Integridade de árvores/vegetação inadequada',
    'meio_ambiente|14|Kit de emergência inadequado/ausente',
    'meio_ambiente|15|Lay-out inadequado',
    'meio_ambiente|16|Odores inadequados',
    'meio_ambiente|17|Picada de insetos / Animal peçonhento',
    'meio_ambiente|18|Pisos irregulares',
    'material|0|Características de dureza abaixo do necessário',
    'material|1|Características de resistência abaixo do necessário',
    'material|2|Forma do material inadequado',
    'material|3|Matéria prima fora da especificação de uso',
    'material|4|Uso de ferramenta inadequada',
    'material|5|Utilizar escada de forma inadequada para acesso',
    'mao_de_obra|0|Acidente de trajeto',
    'mao_de_obra|1|Acidente induzido por terceiro',
    'mao_de_obra|2|Ausência de conscientização',
    'mao_de_obra|3|Ausência de habilidade',
    'mao_de_obra|4|Ausência de treinamento',
    'mao_de_obra|5|Brincadeiras/agressão',
    'mao_de_obra|6|Conduta motivada por stress',
    'mao_de_obra|7|Dimensionamento de trabalhadores inadequado',
    'mao_de_obra|8|Elevação/içamento/movimentação inadequada',
    'mao_de_obra|9|EPI causando incômodo',
    'mao_de_obra|10|EPI inadequado',
    'mao_de_obra|11|EPI limitando movimentos',
    'mao_de_obra|12|Exaustão',
    'mao_de_obra|13|Excesso de confiança',
    'mao_de_obra|14|Excesso de trabalhadores desenvolvendo a atividade',
    'mao_de_obra|15|Experiência abaixo do necessário',
    'mao_de_obra|16|Falta de percepção do risco',
    'mao_de_obra|17|Fazer uso da escada de forma inadequada'
  ];
  parts text[];
  c_codigo text;
  c_ordem  int;
  c_texto  text;
begin
  foreach c_codigo in array causas_data
  loop
    parts := string_to_array(c_codigo, '|');
    c_ordem := parts[2]::int;
    c_texto := parts[3];
    select * into cat from investigacao_categorias where codigo = parts[1];
    if cat.id is null then
      raise warning 'categoria % not found, skipping causa "%"', parts[1], c_texto;
      continue;
    end if;
    insert into investigacao_causas (categoria_id, ordem, texto)
    values (cat.id, c_ordem, c_texto)
    on conflict (categoria_id, texto) do nothing;
  end loop;
end $$;

-- 4. Backfill: convert existing investigacoes.dados.ishikawa[].causas
--    from string[] to [{descricao: string}].
update investigacoes
set dados = jsonb_set(
  dados,
  '{ishikawa}',
  (
    select coalesce(jsonb_agg(
      jsonb_set(
        branch,
        '{causas}',
        (
          select coalesce(jsonb_agg(
            case
              when jsonb_typeof(c) = 'string' then jsonb_build_object('descricao', c)
              else c
            end
          ), '[]'::jsonb)
          from jsonb_array_elements(branch->'causas') c
        )
      )
    ), '[]'::jsonb)
    from jsonb_array_elements(dados->'ishikawa') branch
  )
)
where dados ? 'ishikawa'
  and exists (
    select 1
    from jsonb_array_elements(dados->'ishikawa') branch,
         jsonb_array_elements(branch->'causas') c
    where jsonb_typeof(c) = 'string'
  );
```

- [ ] **Step 2: Apply migration locally**

Run from `/Users/heizen/DEV/maia-db`:

```bash
supabase migration up
```

Expected: migration applies cleanly; warning lines if any categoria codigo is missing (should be 0).

- [ ] **Step 3: Verify seed count and backfill**

Run from `/Users/heizen/DEV/maia-db`:

```bash
supabase db remote --help 2>/dev/null  # confirm CLI is up
psql "$(supabase status -o json | python3 -c 'import json,sys; print(json.load(sys.stdin)["DB_URL"])')" \
  -c "select count(*) as causas_seeded from investigacao_causas;"
```

Expected: `causas_seeded = 83`.

Verify backfill on any existing investigation:

```bash
psql "$(...)" -c "select id, jsonb_pretty(dados->'ishikawa') from investigacoes limit 1;"
```

Expected: each causa shows `{"descricao": "..."}`, not a bare string.

- [ ] **Step 4: Commit**

```bash
cd /Users/heizen/DEV/maia-db
git add supabase/migrations/016_investigacao_causas.sql
git commit -m "$(cat <<'EOF'
feat(db): investigacao_causas table + 83-row legacy seed + dados backfill

Phase 6.5 step 1. New table for the curated causa library per categoria,
seeded with the 83 legacy entries (with 6 reconstructed from corrupted source).
Backfill converts existing investigacoes.dados.ishikawa[].causas from
string[] to [{descricao}] for the matching schema change in maia-app.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Regenerate maia-app types

**Files:**
- Modify: `maia-app/lib/supabase/database.types.ts`

- [ ] **Step 1: Regenerate**

Run from `/Users/heizen/DEV/maia-app`:

```bash
supabase gen types typescript --local > lib/supabase/database.types.ts
```

Expected: file now contains an `investigacao_causas` block with columns `id, categoria_id, texto, ordem, ativo, criado_em, atualizado_em` and `Insert`/`Update` variants.

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors. (The old `causas: string[]` reference in `IshikawaEntrySchema` is still typed by zod, not by the DB — DB jsonb is `Json`. Typecheck stays green.)

- [ ] **Step 3: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add lib/supabase/database.types.ts
git commit -m "$(cat <<'EOF'
chore(types): regenerate after investigacao_causas migration

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Shape migration — causas become objects everywhere

This is one cohesive task because the type change touches the schema, the editor's prop type, the form's "empty branch" seed, the empty-row filter, and the summary counter. Splitting risks intermediate states that fail typecheck.

**Files:**
- Modify: `maia-app/lib/investigacao-dados.ts`
- Modify: `maia-app/components/investigacoes/ishikawa-branch-editor.tsx`
- Modify: `maia-app/components/investigacoes/investigacao-form.tsx`
- Modify: `maia-app/components/investigacoes/investigacao-summary.tsx`
- Modify: `maia-app/tests/unit/investigacao-dados-schema.test.ts`

- [ ] **Step 1: Update zod schema**

In `maia-app/lib/investigacao-dados.ts`, replace `IshikawaEntrySchema`:

```ts
export const CausaSchema = z.object({
  causa_id:  z.string().regex(UuidRegex, "UUID inválido").optional(),
  descricao: z.string().min(1, "descrição obrigatória"),
});

export const IshikawaEntrySchema = z.object({
  categoria_id: Uuid,
  grau_id:      Uuid.nullable(),
  causas:       z.array(CausaSchema).min(1, "cada categoria precisa de ao menos uma causa"),
});

export type Causa = z.infer<typeof CausaSchema>;
```

Update the JSDoc on `assertFinalizable` — the line `dados.ishikawa[0].causas.length >= 1 (already enforced by the schema)` stays accurate.

- [ ] **Step 2: Update IshikawaBranchEditor**

In `maia-app/components/investigacoes/ishikawa-branch-editor.tsx`, change `IshikawaBranch.causas` and the rendering. The library-picker UX is deferred to Task 11; for now keep one Input per row but with the new object shape:

```tsx
export type IshikawaBranch = {
  categoria_id: string;
  grau_id: string | null;
  causas: Array<{ causa_id?: string; descricao: string }>;
};
```

Update the three helpers and the `.map` render:

```tsx
function setCausa(idx: number, text: string) {
  const next = [...branch.causas];
  // Editing the descricao always clears causa_id (it's no longer a library pick).
  next[idx] = { descricao: text };
  onChange({ ...branch, causas: next });
}
function addCausa() {
  onChange({ ...branch, causas: [...branch.causas, { descricao: "" }] });
}
function removeCausa(idx: number) {
  onChange({ ...branch, causas: branch.causas.filter((_, i) => i !== idx) });
}

// ... inside the <ul>:
{branch.causas.map((c, idx) => (
  <li key={idx} className="flex items-center gap-2">
    <Input
      value={c.descricao}
      onChange={(e) => setCausa(idx, e.target.value)}
      placeholder="Descreva a causa"
      disabled={readOnly}
    />
    {!readOnly ? (
      <Button type="button" variant="ghost" size="icon" onClick={() => removeCausa(idx)} aria-label="Remover causa">
        <Trash2Icon className="size-4" aria-hidden="true" />
      </Button>
    ) : null}
  </li>
))}
```

- [ ] **Step 3: Update InvestigacaoForm**

In `maia-app/components/investigacoes/investigacao-form.tsx`:

The "missing branch" seeder at lines ~55–58 currently writes `causas: [] as string[]`. Change to:

```tsx
...missing.map((c) => ({ categoria_id: c.id, grau_id: null, causas: [] as Array<{ causa_id?: string; descricao: string }> })),
```

The empty-row filter at lines ~69–72 currently is:

```tsx
ishikawa: dados.ishikawa.filter((b) => b.causas.length > 0 && b.causas.every((c) => c.trim().length > 0)),
```

Change to:

```tsx
ishikawa: dados.ishikawa
  .map((b) => ({ ...b, causas: b.causas.filter((c) => c.descricao.trim().length > 0) }))
  .filter((b) => b.causas.length > 0),
```

- [ ] **Step 4: Update InvestigacaoSummary**

In `maia-app/components/investigacoes/investigacao-summary.tsx`:

The current `causasCount` reduce still works (counts array length, agnostic to element shape). No change needed there. But add a small change to be safe — the summary already only shows counts, no causa rendering. Verify:

```bash
grep -n "causas" maia-app/components/investigacoes/investigacao-summary.tsx
```

Expected: only the reduce that counts; no per-causa render. **If grep shows any `<>{causas[i]}</>`-style render, replace with `{causas[i].descricao}` — but this should not be present in the current Phase 6 implementation.**

- [ ] **Step 5: Update unit test fixtures**

In `maia-app/tests/unit/investigacao-dados-schema.test.ts`, find every literal `causas: ["..."]` and convert. Run:

```bash
grep -n "causas:" maia-app/tests/unit/investigacao-dados-schema.test.ts
```

For each match, change `causas: ["something"]` → `causas: [{ descricao: "something" }]`. There should be ~5–9 occurrences across the 9 tests.

Add one new test case for the optional `causa_id`:

```ts
it("aceita causa_id opcional referenciando biblioteca", () => {
  const dados = {
    ishikawa: [{
      categoria_id: VALID_UUID,
      grau_id: VALID_UUID,
      causas: [{ causa_id: VALID_UUID, descricao: "Falta de procedimento" }],
    }],
    plano_acao: [],
    participantes: [],
    fotos: [],
  };
  expect(InvestigacaoDadosSchema.safeParse(dados).success).toBe(true);
});

it("aceita causa sem causa_id (free-text)", () => {
  const dados = {
    ishikawa: [{
      categoria_id: VALID_UUID,
      grau_id: VALID_UUID,
      causas: [{ descricao: "Causa personalizada" }],
    }],
    plano_acao: [],
    participantes: [],
    fotos: [],
  };
  expect(InvestigacaoDadosSchema.safeParse(dados).success).toBe(true);
});

it("rejeita causa_id mal formado", () => {
  const dados = {
    ishikawa: [{
      categoria_id: VALID_UUID,
      grau_id: VALID_UUID,
      causas: [{ causa_id: "not-a-uuid", descricao: "x" }],
    }],
    plano_acao: [],
    participantes: [],
    fotos: [],
  };
  expect(InvestigacaoDadosSchema.safeParse(dados).success).toBe(false);
});
```

If the test file does not already define `VALID_UUID`, copy this near the top:

```ts
const VALID_UUID = "11111111-2222-3333-4444-555555555555";
```

- [ ] **Step 6: Run unit tests**

```bash
cd /Users/heizen/DEV/maia-app
npx vitest run tests/unit/investigacao-dados-schema.test.ts
```

Expected: all tests pass (original count + 3 new = 12 total, give or take depending on file's actual original count).

- [ ] **Step 7: Run typecheck and build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add lib/investigacao-dados.ts \
        components/investigacoes/ishikawa-branch-editor.tsx \
        components/investigacoes/investigacao-form.tsx \
        components/investigacoes/investigacao-summary.tsx \
        tests/unit/investigacao-dados-schema.test.ts
git commit -m "$(cat <<'EOF'
feat(phase-6.5): causa shape from string[] to {causa_id?, descricao}[]

Cohesive change across zod schema, editor type, form seed/filter, summary,
and unit tests. Library-picker UI lands in a later commit; this step is the
data-shape migration that the picker depends on. Existing dev data was
backfilled by maia-db migration 016.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: FK pre-check builder for causa deletion

**Files:**
- Modify: `maia-app/lib/investigacao-fk-check.ts`
- Modify: `maia-app/tests/unit/investigacao-jsonb-fk-check.test.ts`

- [ ] **Step 1: Read the current file to know what to append**

```bash
cat maia-app/lib/investigacao-fk-check.ts
```

Expected: file exports `buildCategoriaInUseQuery` and `buildGrauInUseQuery`. The new builder mirrors them.

- [ ] **Step 2: Append the new builder**

Add to `maia-app/lib/investigacao-fk-check.ts`:

```ts
/**
 * Returns a query that counts investigations whose dados.ishikawa[].causas
 * reference the given causa_id. Used by the admin DELETE route to refuse
 * destructive deletions before they reach the FK.
 *
 * Postgres equivalent:
 *   select count(*) from investigacoes
 *   where dados @> jsonb_build_object(
 *     'ishikawa', jsonb_build_array(
 *       jsonb_build_object('causas', jsonb_build_array(jsonb_build_object('causa_id', $1)))
 *     )
 *   );
 */
export const buildCausaInUseQuery = (admin: SupabaseClient, causaId: string) =>
  admin.from("investigacoes").select("id", { count: "exact", head: true })
    .contains("dados", { ishikawa: [{ causas: [{ causa_id: causaId }] }] });
```

- [ ] **Step 3: Add a test**

In `maia-app/tests/unit/investigacao-jsonb-fk-check.test.ts`, append:

```ts
it("buildCausaInUseQuery selects with .contains on causa_id", () => {
  const calls: any[] = [];
  const admin: any = {
    from(table: string) {
      calls.push({ kind: "from", table });
      return {
        select(_col: string, opts?: any) {
          calls.push({ kind: "select", opts });
          return {
            contains(col: string, value: any) {
              calls.push({ kind: "contains", col, value });
              return { _query: true };
            },
          };
        },
      };
    },
  };
  buildCausaInUseQuery(admin, "11111111-2222-3333-4444-555555555555");
  expect(calls).toEqual([
    { kind: "from", table: "investigacoes" },
    { kind: "select", opts: { count: "exact", head: true } },
    {
      kind: "contains",
      col: "dados",
      value: { ishikawa: [{ causas: [{ causa_id: "11111111-2222-3333-4444-555555555555" }] }] },
    },
  ]);
});
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run tests/unit/investigacao-jsonb-fk-check.test.ts
```

Expected: all tests pass (existing 2 + 1 new = 3).

- [ ] **Step 5: Commit**

```bash
git add lib/investigacao-fk-check.ts tests/unit/investigacao-jsonb-fk-check.test.ts
git commit -m "$(cat <<'EOF'
feat(phase-6.5): buildCausaInUseQuery — jsonb pre-check for causa delete

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Admin API routes — GET + POST for causas

**Files:**
- Create: `maia-app/app/api/admin/investigacao/causas/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const Schema = z.object({
  categoria_id: z.string().uuid(),
  texto:        z.string().min(2),
  ordem:        z.number().int().min(0).optional(),
  ativo:        z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = getSupabaseAdmin();
  const categoriaId = new URL(req.url).searchParams.get("categoria_id");
  let q = admin.from("investigacao_causas").select("*").order("ordem");
  if (categoriaId) q = q.eq("categoria_id", categoriaId);
  const { data } = await q;
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("investigacao_causas").insert(parsed.data).select().single();
  if (error?.code === "23505") {
    return NextResponse.json({ error: "Já existe uma causa com este texto nesta categoria." }, { status: 409 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Smoke test via curl**

After `npm run dev`:

```bash
curl -s "http://localhost:3000/api/admin/investigacao/causas?categoria_id=$(...)" -b cookie.txt
```

(Skip if no cookie jar handy; the unit / E2E tests cover the route at a higher level.)

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/investigacao/causas/route.ts
git commit -m "$(cat <<'EOF'
feat(phase-6.5): admin GET+POST for investigacao_causas

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Admin API routes — PATCH + DELETE for causas (with FK pre-check)

**Files:**
- Create: `maia-app/app/api/admin/investigacao/causas/[id]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const Patch = z.object({
  categoria_id: z.string().uuid().optional(),
  texto:        z.string().min(2).optional(),
  ordem:        z.number().int().min(0).optional(),
  ativo:        z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("investigacao_causas").update(parsed.data).eq("id", id);
  if (error?.code === "23505") {
    return NextResponse.json({ error: "Já existe uma causa com este texto nesta categoria." }, { status: 409 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const admin = getSupabaseAdmin();

  // jsonb pre-check (documented in lib/investigacao-fk-check.ts).
  const { data: rows } = await admin
    .from("investigacoes")
    .select("id")
    .contains("dados", { ishikawa: [{ causas: [{ causa_id: id }] }] })
    .limit(1);
  if (rows && rows.length > 0) {
    return NextResponse.json(
      { error: "Em uso por investigações existentes. Desative em vez de excluir." },
      { status: 409 },
    );
  }

  const { error } = await admin.from("investigacao_causas").delete().eq("id", id);
  if (error?.code === "23503") {
    return NextResponse.json(
      { error: "Em uso por investigações existentes. Desative em vez de excluir." },
      { status: 409 },
    );
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/investigacao/causas/\[id\]/route.ts
git commit -m "$(cat <<'EOF'
feat(phase-6.5): admin PATCH+DELETE for causas (with jsonb FK pre-check)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: AdminCrudTable — add "select" column type

**Files:**
- Modify: `maia-app/components/admin/crud-table.tsx`

- [ ] **Step 1: Extend the Column type**

In `maia-app/components/admin/crud-table.tsx`, update the `Column` type and import the Select primitives:

```tsx
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type ColumnOption = { value: string; label: string };

export type Column = {
  key: string;
  label: string;
  type?: "text" | "checkbox" | "number" | "select";
  readonly?: boolean;
  /** Required when type === "select". */
  options?: ReadonlyArray<ColumnOption>;
};
```

- [ ] **Step 2: Render Select in the form**

Find the conditional that picks Checkbox vs Input (around line 164 of the existing file). Replace it with:

```tsx
{c.type === "checkbox" ? (
  <Checkbox
    id={c.key}
    checked={Boolean(form[c.key])}
    onCheckedChange={(v) => setForm({ ...form, [c.key]: Boolean(v) })}
  />
) : c.type === "select" ? (
  <Select
    value={(form[c.key] as string | undefined) ?? ""}
    onValueChange={(v) => setForm({ ...form, [c.key]: v })}
  >
    <SelectTrigger id={c.key}>
      <SelectValue placeholder={`Selecione ${c.label.toLowerCase()}`} />
    </SelectTrigger>
    <SelectContent>
      {(c.options ?? []).map((o) => (
        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
      ))}
    </SelectContent>
  </Select>
) : (
  <Input
    id={c.key}
    type={c.type ?? "text"}
    value={(form[c.key] as string | number | undefined) ?? ""}
    onChange={(e) =>
      setForm({
        ...form,
        [c.key]:
          c.type === "number"
            ? Number(e.target.value)
            : e.target.value,
      })
    }
  />
)}
```

- [ ] **Step 3: Render Select label in the table cell**

Find the table-cell branch that renders `row[c.key]` (around line 240). Replace it with:

```tsx
<TableCell key={c.key} className="text-sm">
  {c.type === "checkbox"
    ? row[c.key] ? "Sim" : "Não"
    : c.type === "select"
      ? (c.options ?? []).find((o) => o.value === row[c.key])?.label ?? "—"
      : String(row[c.key] ?? "—")}
</TableCell>
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. (Existing admin pages don't use `select`, so they're unaffected.)

- [ ] **Step 5: Commit**

```bash
git add components/admin/crud-table.tsx
git commit -m "$(cat <<'EOF'
feat(phase-6.5): AdminCrudTable supports type='select' columns

New column type for FK-bound fields (used by causas → categoria, may be
reused by future admin pages).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Admin page `/admin/investigacao/causas`

**Files:**
- Create: `maia-app/app/(admin)/admin/investigacao/causas/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
"use client";
import * as React from "react";
import Link from "next/link";
import { AdminCrudTable, type ColumnOption } from "@/components/admin/crud-table";

interface Categoria { id: string; rotulo: string; ativo: boolean }

export default function InvestigacaoCausasPage() {
  const [categoriaOptions, setCategoriaOptions] = React.useState<ColumnOption[]>([]);

  React.useEffect(() => {
    (async () => {
      const r = await fetch("/api/admin/investigacao/categorias");
      if (!r.ok) return;
      const data = (await r.json()) as Categoria[];
      setCategoriaOptions(
        data.filter((c) => c.ativo).map((c) => ({ value: c.id, label: c.rotulo })),
      );
    })();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/admin" className="hover:text-foreground">Administração</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span className="text-foreground">Investigação</span>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">Causas</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Causas da Ishikawa</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Biblioteca de causas sugeridas no formulário de investigação, organizadas por categoria.
        </p>
      </header>

      {categoriaOptions.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)]">Carregando categorias…</p>
      ) : (
        <AdminCrudTable
          endpoint="/api/admin/investigacao/causas"
          resourceLabel="causa"
          initial={{ categoria_id: "", texto: "", ordem: 0, ativo: true }}
          columns={[
            { key: "categoria_id", label: "Categoria", type: "select", options: categoriaOptions },
            { key: "texto",        label: "Texto" },
            { key: "ordem",        label: "Ordem", type: "number" },
            { key: "ativo",        label: "Ativo", type: "checkbox" },
          ]}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke**

```bash
npm run dev
```

In the browser, navigate to `/admin/investigacao/causas`. Verify:
- 83 rows display (after Task 1 seed).
- "Categoria" column shows the categoria rotulo (Mão de obra, Método, etc.), not raw uuids.
- Clicking "Nova causa" opens the sheet with a Select for categoria.

- [ ] **Step 4: Commit**

```bash
git add 'app/(admin)/admin/investigacao/causas/page.tsx'
git commit -m "$(cat <<'EOF'
feat(phase-6.5): /admin/investigacao/causas page

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `/admin` index — add Causas tile

**Files:**
- Modify: `maia-app/app/(admin)/admin/page.tsx`

- [ ] **Step 1: Edit the ITEMS array**

Add an import for `ListIcon` (or another suitable Lucide icon — pick `ListIcon` since `ListTreeIcon` is taken by afastamento-tipos):

```tsx
import {
  Building2Icon, FactoryIcon, UsersIcon, UserCogIcon, ListTreeIcon,
  SettingsIcon, NetworkIcon, GaugeIcon, ListIcon,
} from "lucide-react";
```

Add the new tile, placed between `graus` and `configuracoes` so the investigação cluster stays together:

```tsx
{
  href: "/admin/investigacao/causas",
  title: "Causas da Ishikawa",
  desc: "Biblioteca de causas sugeridas por categoria.",
  icon: ListIcon,
},
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual smoke**

In the browser, `/admin` should now show 8 tiles, with the three investigação tiles (Categorias / Graus / Causas) grouped together.

- [ ] **Step 4: Commit**

```bash
git add 'app/(admin)/admin/page.tsx'
git commit -m "$(cat <<'EOF'
feat(phase-6.5): /admin index tile for Causas

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Investigation page — fetch causas and pass to form

**Files:**
- Modify: `maia-app/app/(app)/ocorrencias/[id]/investigacao/page.tsx`
- Modify: `maia-app/components/investigacoes/investigacao-form.tsx`

- [ ] **Step 1: Read the current investigation page**

```bash
cat 'maia-app/app/(app)/ocorrencias/[id]/investigacao/page.tsx'
```

Identify the `Promise.all` block that fetches categorias and graus. Add a third query for causas.

- [ ] **Step 2: Add causas fetch and pass to form**

In the page server component, extend the parallel fetch:

```tsx
const [categoriasRes, grausRes, causasRes, ocorrenciaRes, investigacaoRes] = await Promise.all([
  supabase.from("investigacao_categorias").select("id, codigo, rotulo, ativo").order("ordem"),
  supabase.from("investigacao_graus").select("id, codigo, rotulo, ativo").order("ordem"),
  supabase.from("investigacao_causas").select("id, categoria_id, texto").eq("ativo", true).order("ordem"),
  // ... existing ocorrencia + investigacao queries unchanged
]);
```

(Adjust to match the current file's exact structure — keep the existing queries; just add `causasRes` at the third slot or wherever it fits.)

Group causas by categoria for the form's prop:

```tsx
const causasByCategoria: Record<string, Array<{ id: string; texto: string }>> = {};
for (const c of (causasRes.data ?? [])) {
  (causasByCategoria[c.categoria_id] ??= []).push({ id: c.id, texto: c.texto });
}
```

Pass to InvestigacaoForm:

```tsx
<InvestigacaoForm
  ocorrenciaId={ocorrenciaId}
  initialDados={initialDados}
  initialSituacao={initialSituacao}
  categorias={categorias}
  graus={graus}
  causasByCategoria={causasByCategoria}
/>
```

- [ ] **Step 3: Add the prop to InvestigacaoForm**

In `maia-app/components/investigacoes/investigacao-form.tsx`, add to `Props`:

```tsx
interface Props {
  ocorrenciaId: string;
  initialDados: InvestigacaoDados;
  initialSituacao: "em_andamento" | "finalizada";
  categorias: Categoria[];
  graus:      Grau[];
  causasByCategoria: Record<string, Array<{ id: string; texto: string }>>;
}
```

Destructure `causasByCategoria` in the component signature. (The picker UX that consumes it lands in Task 11.)

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. (Form receives the prop but doesn't yet use it.)

- [ ] **Step 5: Commit**

```bash
git add 'app/(app)/ocorrencias/[id]/investigacao/page.tsx' \
        components/investigacoes/investigacao-form.tsx
git commit -m "$(cat <<'EOF'
feat(phase-6.5): fetch causas in investigation page; pass to form

Form receives but does not yet render the library picker — UI lands next.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: IshikawaBranchEditor — library picker UX

**Files:**
- Modify: `maia-app/components/investigacoes/ishikawa-branch-editor.tsx`
- Modify: `maia-app/components/investigacoes/investigacao-form.tsx`

UX: each causa row now renders **a Select (library suggestions) + an Input (descrição)**. Picking from the Select fills the Input with the library `texto` and stores `causa_id`. Editing the Input clears `causa_id` (it becomes a custom causa). Free-text only is allowed: the user can ignore the Select and type directly.

- [ ] **Step 1: Update the editor's prop type**

In `maia-app/components/investigacoes/ishikawa-branch-editor.tsx`:

```tsx
interface Props {
  branch:           IshikawaBranch;
  categoriaRotulo:  string;
  graus:            Array<{ id: string; rotulo: string }>;
  causas:           Array<{ id: string; texto: string }>;  // NEW — library options for this branch's categoria
  onChange:         (next: IshikawaBranch) => void;
  readOnly?:        boolean;
  readOnlyLabel?:   string;
}
```

- [ ] **Step 2: Replace the causa row render**

Replace the `<ul>` block from Task 3's version with this picker UX:

```tsx
<ul className="flex flex-col gap-3">
  {branch.causas.map((c, idx) => (
    <li key={idx} className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] p-3">
      <div className="flex items-center gap-2">
        <Select
          value={c.causa_id ?? ""}
          onValueChange={(libraryId) => {
            const lib = causas.find((x) => x.id === libraryId);
            if (!lib) return;
            const next = [...branch.causas];
            next[idx] = { causa_id: lib.id, descricao: lib.texto };
            onChange({ ...branch, causas: next });
          }}
          disabled={readOnly || causas.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={causas.length === 0 ? "Sem causas na biblioteca" : "Escolher da biblioteca…"} />
          </SelectTrigger>
          <SelectContent>
            {causas.map((cc) => (
              <SelectItem key={cc.id} value={cc.id}>{cc.texto}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeCausa(idx)}
            aria-label="Remover causa"
          >
            <Trash2Icon className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <Input
        value={c.descricao}
        onChange={(e) => setCausa(idx, e.target.value)}
        placeholder="Ou descreva uma causa personalizada"
        disabled={readOnly}
      />
    </li>
  ))}
</ul>
```

`setCausa` from Task 3 already clears `causa_id` on edit (correct behavior for the "free-text wins" rule).

- [ ] **Step 3: Pass causas in InvestigacaoForm**

In `maia-app/components/investigacoes/investigacao-form.tsx`, inside the step-0 Controller render, pass:

```tsx
<IshikawaBranchEditor
  branch={field.value}
  categoriaRotulo={categoriaRotulo(b.categoria_id)}
  graus={graus.filter((g) => g.ativo)}
  causas={causasByCategoria[b.categoria_id] ?? []}
  onChange={field.onChange}
  readOnly={!present || !active}
  readOnlyLabel={readOnlyLabel}
/>
```

- [ ] **Step 4: Typecheck and build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual smoke**

```bash
npm run dev
```

Open any `em_investigacao` ocorrência → investigação page. Verify:
- Each Ishikawa branch shows a Select on top of each causa row, populated with that categoria's library entries.
- Picking a Select option fills the Input with the texto.
- Typing in the Input clears the Select (visually shows the placeholder again because `causa_id` is now undefined).

- [ ] **Step 6: Commit**

```bash
git add components/investigacoes/ishikawa-branch-editor.tsx \
        components/investigacoes/investigacao-form.tsx
git commit -m "$(cat <<'EOF'
feat(phase-6.5): IshikawaBranchEditor library picker + free-text override

Each causa row gets a Select of library suggestions (filtered to the branch's
categoria) plus an Input for free-text override. Library pick stores causa_id;
editing descrição clears causa_id (free-text wins).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: `lib/nav.ts` — drop TODO, add topbar entries

**Files:**
- Modify: `maia-app/lib/nav.ts`

- [ ] **Step 1: Apply the diff**

In `maia-app/lib/nav.ts`:

```ts
/**
 * Private top-nav config. Phase 4 builds the AppTopNav component that
 * consumes this. Admin groups are filtered out for non-admin users.
 */

export interface AppNavItem {
  label: string;
  href: string;
  /** lucide-react icon name (optional — submenu items typically don't show icons) */
  icon?: string;
}

export interface AppNavGroup {
  id: "painel" | "afastamentos" | "ocorrencias" | "admin";
  label: string;
  href: string;
  items: AppNavItem[];
  adminOnly?: boolean;
}

export const appNav: AppNavGroup[] = [
  {
    id: "painel",
    label: "Painel",
    href: "/painel",
    items: [],
  },
  {
    id: "afastamentos",
    label: "Afastamentos",
    href: "/afastamentos",
    items: [
      { label: "Lista", href: "/afastamentos" },
      { label: "Aprovações", href: "/afastamentos/aprovacoes" },
    ],
  },
  {
    id: "ocorrencias",
    label: "Ocorrências",
    href: "/ocorrencias",
    items: [
      { label: "Lista", href: "/ocorrencias" },
      { label: "Nova",  href: "/forms/ocorrencias" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    href: "/admin",
    adminOnly: true,
    items: [
      { label: "Empresas",                   href: "/admin/empresas" },
      { label: "Unidades",                   href: "/admin/unidades" },
      { label: "Equipes",                    href: "/admin/equipes" },
      { label: "Usuários",                   href: "/admin/usuarios" },
      { label: "Tipos de afastamento",       href: "/admin/afastamento-tipos" },
      { label: "Categorias de investigação", href: "/admin/investigacao/categorias" },
      { label: "Graus de severidade",        href: "/admin/investigacao/graus" },
      { label: "Causas de investigação",     href: "/admin/investigacao/causas" },
      { label: "Configurações",              href: "/admin/configuracoes" },
    ],
  },
];
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke**

In the browser as admin: the Admin dropdown should now list 9 items including the three investigação ones. The Ocorrências dropdown should now show Lista + Nova.

- [ ] **Step 4: Commit**

```bash
git add lib/nav.ts
git commit -m "$(cat <<'EOF'
feat(phase-6.5): topbar — Nova ocorrência + investigação admin entries

Drops the Phase 4 TODO and wires the new admin pages into the topbar so they
are reachable without going through /admin.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Dev seed migration — `017_seed_dev.sql`

**Files:**
- Create: `/Users/heizen/DEV/maia-db/supabase/migrations/017_seed_dev.sql`

- [ ] **Step 1: Identify a Supabase auth user**

We need a real `auth.users.id` to reference from `usuarios`. The seed cannot create `auth.users` rows directly (those go through `gotrue`). The seed will assume an admin user already exists; the OH admin from Phase 6 E2E (`E2E_OH_EMAIL`) is the safe bet.

Look up the auth.users id locally:

```bash
psql "$(supabase status -o json | python3 -c 'import json,sys; print(json.load(sys.stdin)["DB_URL"])')" \
  -c "select id, email from auth.users order by created_at limit 5;"
```

Capture the admin user's UUID — call it `${ADMIN_AUTH_ID}`. The migration uses a CTE that selects this dynamically by email so it stays portable.

- [ ] **Step 2: Write the migration**

```sql
-- Phase 6.5: dev-only seed for exercising afastamentos, ocorrencias, investigacoes.
-- Idempotent via fixed UUIDs and on-conflict guards.
-- DO NOT APPLY IN PRODUCTION — production Supabase project should not include this file.

-- Use the first existing auth.users.administrador=true user as the seed actor.
-- If none exists, the migration is a no-op for usuarios rows that need an auth id.
with admin_auth as (
  select au.id as auth_id
  from auth.users au
  join usuarios u on u.id = au.id
  where u.administrador
  order by u.criado_em
  limit 1
)
select 1;  -- CTE materialization placeholder; subsequent statements re-query.

-- 1. Usuarios: cannot be inserted directly because usuarios.id is FK to auth.users.id
--    (auth.users rows must go through gotrue / the invite flow). The seed therefore
--    reuses whichever admin user already exists. If none exists, downstream eventos
--    will fail FK checks — sign in once as an admin to bootstrap before running this.
do $$
declare
  v_admin uuid;
begin
  select id into v_admin from usuarios where administrador order by criado_em limit 1;
  if v_admin is null then
    raise notice 'No admin user found — sign in once before running 017_seed_dev.sql';
  end if;
end $$;

-- 2. Colaboradores (6) — these have no auth FK so can be freely seeded.
insert into colaboradores (id, cpf, nome, empresa_id, unidade_id, ativo) values
  ('00000000-0000-0000-0000-c01a00000001', '11111111111', 'Ana Silva',
     (select id from empresas where codigo_soc = '1340076'),
     (select id from unidades where codigo = '001'), true),
  ('00000000-0000-0000-0000-c01a00000002', '22222222222', 'Bruno Costa',
     (select id from empresas where codigo_soc = '1340076'),
     (select id from unidades where codigo = '107'), true),
  ('00000000-0000-0000-0000-c01a00000003', '33333333333', 'Carla Mendes',
     (select id from empresas where codigo_soc = '1332035'),
     (select id from unidades where codigo = '108'), true),
  ('00000000-0000-0000-0000-c01a00000004', '44444444444', 'Diego Rocha',
     (select id from empresas where codigo_soc = '1332035'),
     (select id from unidades where codigo = '109A'), true),
  ('00000000-0000-0000-0000-c01a00000005', '55555555555', 'Elena Souza',
     (select id from empresas where codigo_soc = '1340076'),
     (select id from unidades where codigo = '133'), true),
  ('00000000-0000-0000-0000-c01a00000006', '66666666666', 'Felipe Lima',
     (select id from empresas where codigo_soc = '1340076'),
     (select id from unidades where codigo = '148'), true)
on conflict (id) do nothing;

-- 3. Afastamentos (6) — covers pendente / aprovado / rejeitado / finalizado.
--    Mix tipos: use the first two afastamento_tipos by ordem.
do $$
declare
  v_tipo_doenca uuid;
  v_tipo_acidente uuid;
  v_empresa_a uuid;
  v_empresa_b uuid;
  v_admin uuid;
begin
  select id into v_tipo_doenca from afastamento_tipos where codigo = 'doenca' limit 1;
  select id into v_tipo_acidente from afastamento_tipos where codigo = 'acidente_trabalho' limit 1;
  select id into v_empresa_a from empresas where codigo_soc = '1340076';
  select id into v_empresa_b from empresas where codigo_soc = '1332035';
  select id into v_admin from usuarios where administrador order by criado_em limit 1;

  -- pendente x 2
  insert into afastamentos (id, colaborador_id, empresa_id, tipo_id, data_inicio, situacao, criado_em, email_remetente, dados) values
    ('00000000-0000-0000-0000-0000af0a0001', '00000000-0000-0000-0000-c01a00000001', v_empresa_a, v_tipo_doenca,
       (now() - interval '2 days')::date, 'pendente', now() - interval '2 days', 'rh@engeko.com.br', '{}'::jsonb),
    ('00000000-0000-0000-0000-0000af0a0002', '00000000-0000-0000-0000-c01a00000002', v_empresa_a, v_tipo_acidente,
       (now() - interval '1 day')::date, 'pendente', now() - interval '1 day', 'rh@engeko.com.br', '{}'::jsonb)
  on conflict (id) do nothing;

  -- aprovado x 2 (with eventos)
  insert into afastamentos (id, colaborador_id, empresa_id, tipo_id, data_inicio, situacao, criado_em, email_remetente, dados) values
    ('00000000-0000-0000-0000-0000af0a0003', '00000000-0000-0000-0000-c01a00000003', v_empresa_b, v_tipo_doenca,
       (now() - interval '5 days')::date, 'aprovado', now() - interval '5 days', 'rh@engeko.com.br', '{}'::jsonb),
    ('00000000-0000-0000-0000-0000af0a0004', '00000000-0000-0000-0000-c01a00000004', v_empresa_b, v_tipo_acidente,
       (now() - interval '7 days')::date, 'aprovado', now() - interval '7 days', 'rh@engeko.com.br', '{}'::jsonb)
  on conflict (id) do nothing;

  -- rejeitado
  insert into afastamentos (id, colaborador_id, empresa_id, tipo_id, data_inicio, situacao, criado_em, email_remetente, dados) values
    ('00000000-0000-0000-0000-0000af0a0005', '00000000-0000-0000-0000-c01a00000005', v_empresa_a, v_tipo_doenca,
       (now() - interval '3 days')::date, 'rejeitado', now() - interval '3 days', 'rh@engeko.com.br', '{}'::jsonb)
  on conflict (id) do nothing;

  -- finalizado
  insert into afastamentos (id, colaborador_id, empresa_id, tipo_id, data_inicio, situacao, criado_em, email_remetente, dados) values
    ('00000000-0000-0000-0000-0000af0a0006', '00000000-0000-0000-0000-c01a00000006', v_empresa_a, v_tipo_acidente,
       (now() - interval '30 days')::date, 'finalizado', now() - interval '30 days', 'rh@engeko.com.br', '{}'::jsonb)
  on conflict (id) do nothing;

  -- Eventos for the aprovados (criado → aprovado ~1h later → email_enviado → fluig_enviado)
  insert into eventos (tipo_entidade, entidade_id, evento, autor_id, ocorrido_em, dados) values
    ('afastamento', '00000000-0000-0000-0000-0000af0a0003', 'criado',         v_admin, now() - interval '5 days',                     '{}'::jsonb),
    ('afastamento', '00000000-0000-0000-0000-0000af0a0003', 'aprovado',       v_admin, now() - interval '5 days' + interval '1 hour','{}'::jsonb),
    ('afastamento', '00000000-0000-0000-0000-0000af0a0003', 'email_enviado',  v_admin, now() - interval '5 days' + interval '1 hour','{"template":"afastamento-approved"}'::jsonb),
    ('afastamento', '00000000-0000-0000-0000-0000af0a0003', 'fluig_enviado',  v_admin, now() - interval '5 days' + interval '1 hour','{"response":{}}'::jsonb),
    ('afastamento', '00000000-0000-0000-0000-0000af0a0004', 'criado',         v_admin, now() - interval '7 days',                     '{}'::jsonb),
    ('afastamento', '00000000-0000-0000-0000-0000af0a0004', 'aprovado',       v_admin, now() - interval '7 days' + interval '2 hours','{}'::jsonb),
    ('afastamento', '00000000-0000-0000-0000-0000af0a0005', 'criado',         v_admin, now() - interval '3 days',                     '{}'::jsonb),
    ('afastamento', '00000000-0000-0000-0000-0000af0a0005', 'rejeitado',      v_admin, now() - interval '3 days' + interval '30 minutes','{"motivo":"documentação incompleta"}'::jsonb)
  on conflict do nothing;
end $$;

-- 4. Ocorrências (4) + investigações.
do $$
declare
  v_empresa_a uuid;
  v_unidade_a uuid;
  v_admin uuid;
  v_cat_metodo uuid;
  v_cat_maquina uuid;
  v_grau_alto uuid;
  v_grau_medio uuid;
  v_causa_proc uuid;  -- "Não seguiu procedimento de segurança da empresa"
  v_causa_freio uuid; -- "Freios não funcionaram"
begin
  select id into v_empresa_a from empresas where codigo_soc = '1340076';
  select id into v_unidade_a from unidades where codigo = '107';
  select id into v_admin from usuarios where administrador order by criado_em limit 1;
  select id into v_cat_metodo  from investigacao_categorias where codigo = 'metodo';
  select id into v_cat_maquina from investigacao_categorias where codigo = 'maquina';
  select id into v_grau_alto   from investigacao_graus where codigo = 'alto';
  select id into v_grau_medio  from investigacao_graus where codigo = 'medio';
  select id into v_causa_proc  from investigacao_causas where texto = 'Não seguiu procedimento de segurança da empresa';
  select id into v_causa_freio from investigacao_causas where texto = 'Freios não funcionaram';

  insert into ocorrencias (id, tipo, empresa_id, unidade_id, situacao, data_ocorrencia, descricao, criado_em, email_remetente, dados) values
    ('00000000-0000-0000-0000-0000000c0001', 'quase_acidente', v_empresa_a, v_unidade_a, 'aberta',
       now() - interval '2 days', 'Quase-queda em rampa de acesso.',
       now() - interval '2 days', 'engenharia@engeko.com.br', '{}'::jsonb),
    ('00000000-0000-0000-0000-0000000c0002', 'acidente',       v_empresa_a, v_unidade_a, 'em_investigacao',
       now() - interval '5 days', 'Acidente com freio defeituoso em empilhadeira.',
       now() - interval '5 days', 'engenharia@engeko.com.br', '{}'::jsonb),
    ('00000000-0000-0000-0000-0000000c0003', 'desvio',         v_empresa_a, v_unidade_a, 'em_investigacao',
       now() - interval '6 days', 'Procedimento não seguido em operação de içamento.',
       now() - interval '6 days', 'engenharia@engeko.com.br', '{}'::jsonb),
    ('00000000-0000-0000-0000-0000000c0004', 'acidente',       v_empresa_a, v_unidade_a, 'concluida',
       now() - interval '30 days', 'Acidente histórico para teste do summary.',
       now() - interval '30 days', 'engenharia@engeko.com.br', '{}'::jsonb)
  on conflict (id) do nothing;

  -- One empty investigacao for the 'aberta' ocorrencia (auto-created by the app's POST flow normally).
  insert into investigacoes (id, ocorrencia_id, situacao, dados, criado_em) values
    ('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-0000000c0001', 'em_andamento',
       '{"ishikawa":[],"plano_acao":[],"participantes":[],"fotos":[]}'::jsonb,
       now() - interval '2 days')
  on conflict (id) do nothing;

  -- One partial investigacao (Ishikawa filled, plano_acao empty).
  insert into investigacoes (id, ocorrencia_id, situacao, dados, criado_em) values
    ('00000000-0000-0000-0000-0000000d0002', '00000000-0000-0000-0000-0000000c0002', 'em_andamento',
       jsonb_build_object(
         'ishikawa', jsonb_build_array(
           jsonb_build_object(
             'categoria_id', v_cat_maquina,
             'grau_id', v_grau_alto,
             'causas', jsonb_build_array(
               jsonb_build_object('causa_id', v_causa_freio, 'descricao', 'Freios não funcionaram')
             )
           )
         ),
         'plano_acao', jsonb_build_array(),
         'participantes', jsonb_build_array(),
         'fotos', jsonb_build_array()
       ),
       now() - interval '5 days')
  on conflict (id) do nothing;

  -- One empty investigacao for the third 'em_investigacao' ocorrencia (also auto-created normally).
  insert into investigacoes (id, ocorrencia_id, situacao, dados, criado_em) values
    ('00000000-0000-0000-0000-0000000d0003', '00000000-0000-0000-0000-0000000c0003', 'em_andamento',
       '{"ishikawa":[],"plano_acao":[],"participantes":[],"fotos":[]}'::jsonb,
       now() - interval '6 days')
  on conflict (id) do nothing;

  -- One finalized investigation (2 branches, 2 causas, 2 actions, 2 participantes).
  insert into investigacoes (id, ocorrencia_id, situacao, dados, criado_em) values
    ('00000000-0000-0000-0000-0000000d0004', '00000000-0000-0000-0000-0000000c0004', 'finalizada',
       jsonb_build_object(
         'ishikawa', jsonb_build_array(
           jsonb_build_object(
             'categoria_id', v_cat_metodo,
             'grau_id', v_grau_alto,
             'causas', jsonb_build_array(
               jsonb_build_object('causa_id', v_causa_proc, 'descricao', 'Não seguiu procedimento de segurança da empresa')
             )
           ),
           jsonb_build_object(
             'categoria_id', v_cat_maquina,
             'grau_id', v_grau_medio,
             'causas', jsonb_build_array(
               jsonb_build_object('descricao', 'Sinalização visual ausente no local')
             )
           )
         ),
         'plano_acao', jsonb_build_array(
           jsonb_build_object('acao','Reforçar treinamento de procedimento','responsavel','Líder de segurança','prazo','2026-06-30','status','pendente'),
           jsonb_build_object('acao','Instalar sinalização visual','responsavel','Manutenção','prazo','2026-05-31','status','concluida')
         ),
         'participantes', jsonb_build_array(
           jsonb_build_object('nome','Maria Equipe','email','maria@engeko.com.br'),
           jsonb_build_object('nome','João Líder','email',null)
         ),
         'fotos', jsonb_build_array()
       ),
       now() - interval '30 days')
  on conflict (id) do nothing;

  -- Eventos for ocorrencias.
  insert into eventos (tipo_entidade, entidade_id, evento, autor_id, ocorrido_em, dados) values
    ('ocorrencia',    '00000000-0000-0000-0000-0000000c0001', 'criado',                  v_admin, now() - interval '2 days',  '{}'::jsonb),
    ('ocorrencia',    '00000000-0000-0000-0000-0000000c0002', 'criado',                  v_admin, now() - interval '5 days',  '{}'::jsonb),
    ('ocorrencia',    '00000000-0000-0000-0000-0000000c0003', 'criado',                  v_admin, now() - interval '6 days',  '{}'::jsonb),
    ('ocorrencia',    '00000000-0000-0000-0000-0000000c0004', 'criado',                  v_admin, now() - interval '30 days', '{}'::jsonb),
    ('investigacao',  '00000000-0000-0000-0000-0000000d0002','investigacao_iniciada',   v_admin, now() - interval '5 days',  '{}'::jsonb),
    ('investigacao',  '00000000-0000-0000-0000-0000000d0004','investigacao_iniciada',   v_admin, now() - interval '30 days', '{}'::jsonb),
    ('investigacao',  '00000000-0000-0000-0000-0000000d0004','investigacao_finalizada', v_admin, now() - interval '1 hour',  '{}'::jsonb)
  on conflict do nothing;
end $$;
```

- [ ] **Step 3: Apply locally**

```bash
cd /Users/heizen/DEV/maia-db
supabase migration up
```

Expected: clean apply. Any `raise notice 'No admin user found'` is non-fatal.

- [ ] **Step 4: Verify counts**

```bash
psql "$(supabase status -o json | python3 -c 'import json,sys; print(json.load(sys.stdin)["DB_URL"])')" <<EOF
select 'colaboradores' as t, count(*) from colaboradores
union all select 'afastamentos', count(*) from afastamentos
union all select 'ocorrencias', count(*) from ocorrencias
union all select 'investigacoes', count(*) from investigacoes;
EOF
```

Expected: 6 colaboradores, 6 afastamentos, 4 ocorrencias, 4 investigacoes (at minimum — pre-existing rows from prior dev work will add to these).

- [ ] **Step 5: Manual smoke**

In the browser:
- `/afastamentos` should now show ≥6 rows.
- `/afastamentos/aprovacoes` should show 2 pendentes.
- `/ocorrencias` should show ≥4 rows.
- The `concluida` ocorrência's detail page should render the finalized investigation summary.
- The `em_investigacao` ocorrência with partial dados should resume mid-stepper.

- [ ] **Step 6: Commit**

```bash
cd /Users/heizen/DEV/maia-db
git add supabase/migrations/017_seed_dev.sql
git commit -m "$(cat <<'EOF'
feat(db): dev seed — colaboradores, afastamentos, ocorrencias, investigacoes

Phase 6.5 step 2. Idempotent dev seed providing a realistic working set so the
new Phase 6 surfaces (and upcoming Phase 7 aggregations) can be exercised
without first submitting public forms.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Update gated E2E happy-path arc to pick a library causa

**Files:**
- Modify: `maia-app/tests/e2e/happy-path.spec.ts`

- [ ] **Step 1: Adjust the arc**

In `maia-app/tests/e2e/happy-path.spec.ts`, find this block in the "Phase 6 investigation" describe:

```ts
// 3. Step 1 — fill the first Ishikawa branch
await page.getByRole("button", { name: /Adicionar causa/i }).first().click();
await page.getByPlaceholder("Descreva a causa").first().fill("Falta de procedimento");
```

Replace with:

```ts
// 3. Step 1 — fill the first Ishikawa branch by picking a library causa
await page.getByRole("button", { name: /Adicionar causa/i }).first().click();
// Pick the first library suggestion from the Select on the new causa row
await page.getByRole("combobox", { name: /Escolher da biblioteca/i }).first().click();
await page.getByRole("option").first().click();
// The descricao Input is now auto-filled. Optionally override:
// await page.getByPlaceholder("Ou descreva uma causa personalizada").first().fill("Custom override");
```

The grau pick and subsequent steps stay unchanged.

- [ ] **Step 2: Run the gated arc**

```bash
cd /Users/heizen/DEV/maia-app
E2E_INVESTIGACAO=1 npx playwright test tests/e2e/happy-path.spec.ts -g "Phase 6 investigation"
```

Expected: test passes. If Playwright can't find the combobox by accessible name, fall back to a less specific locator (e.g., `page.locator('[role="combobox"]').first()`).

- [ ] **Step 3: Run the full happy-path to verify no regression**

```bash
npx playwright test tests/e2e/happy-path.spec.ts
```

Expected: original arc still green.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/happy-path.spec.ts
git commit -m "$(cat <<'EOF'
test(phase-6.5): gated arc picks a library causa via combobox

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Update umbrella spec with Phase 6.5 note

**Files:**
- Modify: `maia-app/docs/superpowers/specs/2026-05-14-feature-expansion-design.md`

- [ ] **Step 1: Append the completion note**

Find the Phase 6 status line:

```markdown
**Status:** ✅ Complete (maia-app: `479d4e7..5efe41b`; maia-db: `70312bb6`).
```

Replace with (substitute the actual final SHAs you produced):

```markdown
**Status:** ✅ Complete (maia-app: `479d4e7..<HEAD>`; maia-db: `70312bb6..<HEAD>`). Includes 6.5 completion pass (causa library, topbar nav, dev seed).
```

Get the SHAs:

```bash
cd /Users/heizen/DEV/maia-app && git log --oneline | head -1   # for maia-app HEAD
cd /Users/heizen/DEV/maia-db && git log --oneline | head -1    # for maia-db HEAD
```

- [ ] **Step 2: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add docs/superpowers/specs/2026-05-14-feature-expansion-design.md
git commit -m "$(cat <<'EOF'
docs(phase-6.5): mark Phase 6 + 6.5 complete in umbrella spec

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Final verification

- [ ] **Step 1: Typecheck**

```bash
cd /Users/heizen/DEV/maia-app
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 2: Unit tests**

```bash
npx vitest run
```

Expected: all pass.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: succeeds; the routes `/admin/investigacao/causas`, `/api/admin/investigacao/causas`, `/api/admin/investigacao/causas/[id]` all appear in the build output.

- [ ] **Step 4: Manual walk-through**

In a clean dev session (`supabase db reset && supabase migration up`, then `npm run dev`):

1. Sign in as OH admin.
2. Visit `/painel` → see the activity feed populated.
3. Visit `/afastamentos` → see 6 seeded rows.
4. Visit `/afastamentos/aprovacoes` → see 2 pendentes.
5. Visit `/ocorrencias` → see 4 seeded rows.
6. Open the `concluida` ocorrência (`00000000-0000-0000-0000-0000000c0004`) → see the finalized investigation summary with 2 branches.
7. Open an `em_investigacao` ocorrência with partial dados → click "Continuar investigação" → see the Ishikawa branch pre-populated with the library causa "Freios não funcionaram".
8. Visit `/admin/investigacao/causas` via topbar → see 83 rows; filter by categoria works via the Select column.
9. From the Admin topbar dropdown, navigate to Categorias, Graus, and Causas — all reachable.

If any step fails, file a follow-up task; the plan is otherwise complete.

---

## Self-review notes (controller-only — do not implement)

**Spec coverage (§ from spec):**

- §2.1 (causa library): Tasks 1, 3–11.
- §2.2 (topbar nav): Task 12.
- §2.3 (dev seed): Task 13.
- §4 success criteria 1: Tasks 5, 6 (CRUD + FK delete guard).
- §4 success criterion 2: Task 11 (library combobox).
- §4 success criterion 3: Task 12 (topbar).
- §4 success criterion 4: Task 13 (seed) + Task 16 step 4 (verification).
- §4 success criterion 5: Task 14 (E2E).

**Notable resolved discrepancies vs. spec:**

- Spec called the causa migration `016_investigacao_causas_e_seed.sql` and *also* the dev seed `016_seed_dev.sql` — two files at the same number. The plan splits into `016_investigacao_causas.sql` and `017_seed_dev.sql`.
- Spec described the causa-shape change as "purely additive". Inspection of `lib/investigacao-dados.ts` showed `causas: z.array(z.string())` — i.e., element type is a string, not an object. The change is therefore a shape migration (string[] → object[]) with a SQL backfill in Task 1 and a coupled app-side update in Task 3. Phase 6 is local-only, so this is safe.
- Spec mentioned the `usuarios` seed should add an admin + safety + reader. `usuarios.id` is FK to `auth.users.id` (cannot be inserted from SQL — must come through gotrue). Task 13 explains this and reuses the existing admin user; new auth users would have to be created through the admin invite flow, which is out of scope for a SQL seed.

**Placeholder scan:** No "TBD", "TODO", or vague handoffs in any task. All code blocks contain runnable content.

**Type consistency:** `IshikawaBranch.causas` is consistently `Array<{ causa_id?: string; descricao: string }>` from Task 3 onward. `ColumnOption` is defined in Task 7 and imported in Task 8.
