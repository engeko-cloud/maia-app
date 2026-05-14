# Phase 6 — Ishikawa Investigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4-text-field placeholder at `/ocorrencias/[id]/investigacao` with a DB-template-driven 4-section stepper form (Ishikawa branches + Plano de Ação + Participantes + Fotos), ship admin CRUD pages for the templates, and wire the `safety` equipe into the public ocorrência creation flow so it receives notifications.

**Architecture:** maia-db migration adds two admin-editable tables (`investigacao_categorias`, `investigacao_graus`) and aligns the `ocorrencias.situacao` check constraint with the maia-app vocabulary. maia-app gets a new `<InvestigacaoForm>` stepper composed of four small editor components (Ishikawa / Plano de Ação / Participantes / Fotos), two thin admin pages reusing the Phase 5 `<AdminCrudTable>`, four new admin route handlers per resource (categorias + graus), a new private upload route for fotos, a rename of the Phase 5 preview route under `/api/private/anexos/preview` with a thin re-export at the old `/api/public/afastamentos/upload/preview` path for one release, and a new email template `ocorrencia-nova-para-safety` plumbed through the existing `sendMail` registry. The `POST /api/public/ocorrencias` route is extended to auto-create the `investigacoes` row and dispatch the safety notification (best-effort, never failing the public submission). All investigation-touching routes are gated by a new `requireSafetyOrAdmin` helper next to `requireAdminUser`.

**Tech Stack:** Next.js 16 App Router (route groups `(app)`, `(admin)`, `(public)`, `(api)`-via `app/api`), React 19 server components by default, Tailwind v4 tokens, shadcn `base-nova` (`@base-ui/react`) primitives, `react-hook-form` + `zod`, `date-fns` (`pt-BR` locale), `lucide-react`, Supabase SSR (`@supabase/ssr`) + service-role admin client, Resend via the existing `sendMail` wrapper, Vitest unit tests, Playwright E2E.

**Cross-cutting rules:**

- **Radius rule**: cap at `rounded-md`; never `rounded-full` on rectangles. Existing `rounded-xl` cards in Phase 1–4 surfaces are grandfathered.
- **DB-backed config**: no new entries to `lib/data/*.json`. Anything editable lives in maia-db.
- **TDD**: write the test first, watch it fail, write the minimal code, watch it pass. Commit at every green.
- **YAGNI**: do not pre-build for Phase 7/8 needs (no `<MetricCard>`, no portal copy machinery — those belong to their own phases).

---

## File Structure

```
maia-db/
└── supabase/
    └── migrations/
        └── 015_investigacao_categorias_graus.sql      NEW (single migration)

maia-app/
├── app/
│   ├── (admin)/
│   │   ├── admin/
│   │   │   ├── page.tsx                                MODIFY (link to investigation admin)
│   │   │   ├── investigacao/
│   │   │   │   ├── categorias/page.tsx                 NEW
│   │   │   │   └── graus/page.tsx                      NEW
│   ├── (app)/
│   │   └── ocorrencias/
│   │       ├── [id]/page.tsx                           MODIFY (replace InvestigationStarter)
│   │       └── [id]/investigacao/page.tsx              REWRITE
│   ├── api/
│   │   ├── admin/
│   │   │   └── investigacao/
│   │   │       ├── categorias/route.ts                 NEW (GET, POST)
│   │   │       ├── categorias/[id]/route.ts            NEW (PATCH, DELETE w/ jsonb pre-check)
│   │   │       ├── graus/route.ts                      NEW (GET, POST)
│   │   │       └── graus/[id]/route.ts                 NEW (PATCH, DELETE w/ jsonb pre-check)
│   │   ├── ocorrencias/[id]/investigacao/route.ts      REWRITE (new zod, finalize gate, eventos, requireSafetyOrAdmin)
│   │   ├── public/
│   │   │   ├── ocorrencias/route.ts                    MODIFY (auto-create investigacao + safety notify)
│   │   │   └── afastamentos/upload/preview/route.ts    MODIFY (thin re-export of new private route)
│   │   └── private/
│   │       ├── anexos/preview/route.ts                 NEW (renamed; accepts afastamentos/ + investigacoes/ prefixes)
│   │       └── investigacoes/upload/route.ts           NEW
├── components/
│   ├── investigacoes/
│   │   ├── investigacao-form.tsx                       NEW (stepper orchestrator, client)
│   │   ├── ishikawa-branch-editor.tsx                  NEW (client)
│   │   ├── action-item-editor.tsx                      NEW (client)
│   │   ├── participante-list.tsx                       NEW (client)
│   │   ├── foto-uploader.tsx                           NEW (client)
│   │   ├── investigacao-summary.tsx                    NEW (server)
│   │   └── investigation-status.tsx                    NEW (server; replaces components/ocorrencias/investigation-starter.tsx)
│   └── ocorrencias/
│       ├── investigation-starter.tsx                   DELETE (replaced by components/investigacoes/investigation-status.tsx)
│       └── investigacao-form.tsx                       DELETE (Phase 5 placeholder)
├── emails/
│   └── ocorrencia-nova-para-safety.ts                  NEW
├── lib/
│   ├── admin-auth.ts                                   MODIFY (add requireSafetyOrAdmin)
│   ├── eventos.ts                                      MODIFY (extend EventoType union)
│   ├── investigacao-dados.ts                           NEW (zod schema for dados)
│   ├── investigacao-state.ts                           NEW (constants + label resolvers)
│   ├── mail/send.ts                                    MODIFY (register new template)
│   └── safety-notify.ts                                NEW (recipient resolver)
└── tests/
    ├── e2e/happy-path.spec.ts                          MODIFY (gated investigation arc)
    └── unit/
        ├── investigacao-dados-schema.test.ts           NEW
        ├── investigacao-permissions.test.ts            NEW
        ├── investigacao-jsonb-fk-check.test.ts         NEW
        └── safety-notify.test.ts                       NEW
```

---

# Section A — Data layer

### Task 1: maia-db migration

Two new admin-editable tables + GIN index on `investigacoes.dados` for the FK pre-check + alignment of the `ocorrencias.situacao` check constraint with the maia-app vocabulary (`aberta | em_investigacao | concluida` — the existing DB constraint allows `finalizada` but the app writes `concluida`; a long-latent bug surfaced when Phase 6 actually finalizes investigations).

> **Note**: This task runs in the **maia-db** repository at `/Users/heizen/DEV/maia-db`, not maia-app. Apply locally first, then regenerate types in maia-app (Task 2).

**Files:**
- Create: `/Users/heizen/DEV/maia-db/supabase/migrations/015_investigacao_categorias_graus.sql`

- [ ] **Step 1: Write the migration**

Create `/Users/heizen/DEV/maia-db/supabase/migrations/015_investigacao_categorias_graus.sql`:

```sql
-- Phase 6: Ishikawa investigation — admin-editable templates + jsonb integrity index
-- Plus: align ocorrencias.situacao check constraint with maia-app vocabulary.

-- 1. Categorias (the 6Ms of the Ishikawa fishbone)
create table investigacao_categorias (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique,
  rotulo       text not null,
  ordem        int  not null default 0,
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_investigacao_categorias_ordem on investigacao_categorias(ordem) where ativo;

create trigger trg_investigacao_categorias_atualizado
  before update on investigacao_categorias
  for each row execute function set_atualizado_em();

-- 2. Graus (severity scale)
create table investigacao_graus (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique,
  rotulo       text not null,
  ordem        int  not null default 0,
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_investigacao_graus_ordem on investigacao_graus(ordem) where ativo;

create trigger trg_investigacao_graus_atualizado
  before update on investigacao_graus
  for each row execute function set_atualizado_em();

-- 3. Seed defaults (idempotent via on-conflict)
insert into investigacao_categorias (codigo, rotulo, ordem) values
  ('mao_de_obra',   'Mão de obra',  0),
  ('metodo',        'Método',       1),
  ('maquina',       'Máquina',      2),
  ('material',      'Material',     3),
  ('medida',        'Medida',       4),
  ('meio_ambiente', 'Meio ambiente',5)
on conflict (codigo) do nothing;

insert into investigacao_graus (codigo, rotulo, ordem) values
  ('alto',  'Alto',  0),
  ('medio', 'Médio', 1),
  ('baixo', 'Baixo', 2)
on conflict (codigo) do nothing;

-- 4. GIN index on investigacoes.dados for the categoria/grau jsonb pre-check on DELETE
create index if not exists idx_investigacoes_dados_gin
  on investigacoes using gin (dados jsonb_path_ops);

-- 5. Fix ocorrencias.situacao check constraint to match maia-app vocabulary.
--    Existing constraint allowed ('aberta','em_investigacao','finalizada','cancelada'),
--    but app writes 'concluida' on finalize. Drop and re-add.
alter table ocorrencias drop constraint if exists ocorrencias_situacao_check;
alter table ocorrencias add constraint ocorrencias_situacao_check
  check (situacao in ('aberta','em_investigacao','concluida','cancelada'));

-- 6. RLS (admin write, authenticated read for categorias/graus)
alter table investigacao_categorias enable row level security;
alter table investigacao_graus      enable row level security;

create policy "categorias_read_authenticated" on investigacao_categorias
  for select to authenticated using (true);
create policy "categorias_write_admin" on investigacao_categorias
  for all to authenticated using (
    exists (select 1 from usuarios where id = auth.uid() and administrador)
  ) with check (
    exists (select 1 from usuarios where id = auth.uid() and administrador)
  );

create policy "graus_read_authenticated" on investigacao_graus
  for select to authenticated using (true);
create policy "graus_write_admin" on investigacao_graus
  for all to authenticated using (
    exists (select 1 from usuarios where id = auth.uid() and administrador)
  ) with check (
    exists (select 1 from usuarios where id = auth.uid() and administrador)
  );
```

- [ ] **Step 2: Apply the migration locally**

Run from `/Users/heizen/DEV/maia-db`:

```bash
supabase db reset --local   # if you want a clean rebuild (destructive locally)
# OR if preserving local data:
supabase migration up
```

Expected: migration applies cleanly, no errors, two new tables visible in Studio (`http://127.0.0.1:54323`).

- [ ] **Step 3: Verify seed and constraint**

```bash
psql "$(supabase status --output env | grep DB_URL | cut -d= -f2 | tr -d \")" -c "
  select codigo, rotulo, ordem from investigacao_categorias order by ordem;
  select codigo, rotulo, ordem from investigacao_graus order by ordem;
  select conname, pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'ocorrencias'::regclass and contype = 'c';
"
```

Expected: 6 categorias rows, 3 graus rows, `ocorrencias_situacao_check` includes `concluida`.

- [ ] **Step 4: Commit (in maia-db repo)**

```bash
cd /Users/heizen/DEV/maia-db
git add supabase/migrations/015_investigacao_categorias_graus.sql
git commit -m "feat(db): investigacao_categorias + graus + ocorrencias situacao fix"
```

---

### Task 2: Regenerate Supabase types in maia-app

After Task 1 lands locally, regenerate the TypeScript types so the new tables show up in `Database`. Without this, every subsequent task hits `Property 'investigacao_categorias' does not exist on type ...`.

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/lib/supabase/database.types.ts`

- [ ] **Step 1: Regenerate types**

Run from `/Users/heizen/DEV/maia-app`:

```bash
supabase gen types typescript --local > lib/supabase/database.types.ts
```

- [ ] **Step 2: Strip any CLI prefix/suffix noise**

Open `lib/supabase/database.types.ts`. If the first line is `Connecting to db 5432` or similar, delete it. If the last lines contain `<claude-code-hint>...</claude-code-hint>`, delete them. The file must start with `export type Json = ...` (or `export type Database = ...` depending on CLI version) and end on the closing brace.

- [ ] **Step 3: Verify typecheck stays clean**

```bash
npx tsc --noEmit
```

Expected: zero errors. New tables `investigacao_categorias` and `investigacao_graus` should now appear in `Database['public']['Tables']`.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/database.types.ts
git commit -m "chore(types): regenerate after investigacao_categorias + graus migration"
```

---

### Task 3: Investigation state constants

Small helper module for the four `plano_acao` statuses, the two `investigacoes.situacao` values, and human labels. Keeps every UI lookup in one place (DRY).

**Files:**
- Create: `/Users/heizen/DEV/maia-app/lib/investigacao-state.ts`

- [ ] **Step 1: Write the file**

```ts
// lib/investigacao-state.ts
export const INVESTIGACAO_SITUACOES = ["em_andamento", "finalizada"] as const;
export type InvestigacaoSituacao = (typeof INVESTIGACAO_SITUACOES)[number];

const SITUACAO_LABELS: Record<InvestigacaoSituacao, string> = {
  em_andamento: "Em andamento",
  finalizada:   "Finalizada",
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

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add lib/investigacao-state.ts
git commit -m "feat(phase-6): investigacao state constants + labels"
```

---

### Task 4: `dados` zod schema + finalize gate

The single source of truth for what `investigacoes.dados` can hold. Used by the PATCH/POST route handler (server) and the form's zodResolver (client). Includes the "finalize gate" that the server enforces when `situacao: 'finalizada'`.

**Files:**
- Create: `/Users/heizen/DEV/maia-app/lib/investigacao-dados.ts`
- Test: `/Users/heizen/DEV/maia-app/tests/unit/investigacao-dados-schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/investigacao-dados-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InvestigacaoDadosSchema, assertFinalizable } from "@/lib/investigacao-dados";

const UUID_A = "00000000-0000-0000-0000-000000000001";
const UUID_B = "00000000-0000-0000-0000-000000000002";

describe("InvestigacaoDadosSchema", () => {
  it("accepts a fully populated dados", () => {
    const result = InvestigacaoDadosSchema.safeParse({
      ishikawa: [
        { categoria_id: UUID_A, grau_id: UUID_B, causas: ["falta de treino"] },
      ],
      plano_acao: [
        { acao: "treinar equipe", responsavel: "João", prazo: "2026-06-30", status: "pendente" },
      ],
      participantes: [{ nome: "Maria", email: "maria@x.com" }],
      fotos: [{ path: "investigacoes/abc/123.jpg", legenda: "máquina" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty arrays (draft state)", () => {
    const result = InvestigacaoDadosSchema.safeParse({
      ishikawa: [], plano_acao: [], participantes: [], fotos: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-uuid categoria_id", () => {
    const result = InvestigacaoDadosSchema.safeParse({
      ishikawa: [{ categoria_id: "not-a-uuid", grau_id: null, causas: ["x"] }],
      plano_acao: [], participantes: [], fotos: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-iso prazo", () => {
    const result = InvestigacaoDadosSchema.safeParse({
      ishikawa: [],
      plano_acao: [{ acao: "x", responsavel: "y", prazo: "30/06/2026", status: "pendente" }],
      participantes: [], fotos: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid plano_acao status", () => {
    const result = InvestigacaoDadosSchema.safeParse({
      ishikawa: [],
      plano_acao: [{ acao: "x", responsavel: "y", prazo: "2026-06-30", status: "feito" as never }],
      participantes: [], fotos: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty causas in an ishikawa entry", () => {
    const result = InvestigacaoDadosSchema.safeParse({
      ishikawa: [{ categoria_id: UUID_A, grau_id: null, causas: [] }],
      plano_acao: [], participantes: [], fotos: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("assertFinalizable", () => {
  const valid = {
    ishikawa: [{ categoria_id: UUID_A, grau_id: null, causas: ["c"] }],
    plano_acao: [{ acao: "a", responsavel: "r", prazo: "2026-06-30", status: "pendente" as const }],
    participantes: [], fotos: [],
  };

  it("passes for valid finalize payload", () => {
    expect(() => assertFinalizable(valid)).not.toThrow();
  });

  it("throws if no ishikawa", () => {
    expect(() => assertFinalizable({ ...valid, ishikawa: [] })).toThrow(/ishikawa/);
  });

  it("throws if no plano_acao", () => {
    expect(() => assertFinalizable({ ...valid, plano_acao: [] })).toThrow(/plano/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run tests/unit/investigacao-dados-schema.test.ts
```

Expected: FAIL with module-not-found on `@/lib/investigacao-dados`.

- [ ] **Step 3: Implement the schema**

Create `lib/investigacao-dados.ts`:

```ts
import { z } from "zod";

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "prazo deve ser ISO YYYY-MM-DD");

export const IshikawaEntrySchema = z.object({
  categoria_id: z.string().uuid(),
  grau_id:      z.string().uuid().nullable(),
  causas:       z.array(z.string().min(1)).min(1, "cada categoria precisa de ao menos uma causa"),
});

export const PlanoAcaoEntrySchema = z.object({
  acao:        z.string().min(1),
  responsavel: z.string().min(1),
  prazo:       IsoDate,
  status:      z.enum(["pendente", "em_andamento", "concluida", "cancelada"]),
});

export const ParticipanteEntrySchema = z.object({
  nome:  z.string().min(1),
  email: z.string().email().nullable(),
});

export const FotoEntrySchema = z.object({
  path:    z.string().min(1),
  legenda: z.string().nullable(),
});

export const InvestigacaoDadosSchema = z.object({
  ishikawa:      z.array(IshikawaEntrySchema),
  plano_acao:    z.array(PlanoAcaoEntrySchema),
  participantes: z.array(ParticipanteEntrySchema),
  fotos:         z.array(FotoEntrySchema),
});

export type InvestigacaoDados = z.infer<typeof InvestigacaoDadosSchema>;

/** Throws if the dados shape is not ready to finalize.
 *  Rules per spec §3.3:
 *  - dados.ishikawa.length >= 1
 *  - dados.ishikawa[0].causas.length >= 1 (already enforced by the schema)
 *  - dados.plano_acao.length >= 1
 */
export function assertFinalizable(dados: InvestigacaoDados): void {
  if (dados.ishikawa.length === 0) {
    throw new Error("Para finalizar, registre ao menos uma entrada de ishikawa.");
  }
  if (dados.plano_acao.length === 0) {
    throw new Error("Para finalizar, registre ao menos um item no plano de ação.");
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
npx vitest run tests/unit/investigacao-dados-schema.test.ts
```

Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/investigacao-dados.ts tests/unit/investigacao-dados-schema.test.ts
git commit -m "feat(phase-6): dados zod schema + finalize gate"
```

---

### Task 5: Extend `EventoType` union

Add the four new event tipos to the TypeScript union in `lib/eventos.ts`. No DB migration needed (the `eventos.evento` column has no check constraint).

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/lib/eventos.ts`

- [ ] **Step 1: Edit the union**

Open `lib/eventos.ts`, replace the `EventoType` definition:

```ts
export type EventoType =
  | "criado" | "rejeitado" | "resubmetido" | "aprovado"
  | "fluig_enviado" | "fluig_erro" | "email_enviado" | "cancelado"
  | "investigacao_iniciada" | "investigacao_finalizada"
  | "ocorrencia_para_safety_enviada" | "ocorrencia_para_safety_falhou";
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add lib/eventos.ts
git commit -m "feat(phase-6): extend EventoType with investigation + safety-notify events"
```

---

# Section B — Permissions & notifications

### Task 6: `requireSafetyOrAdmin` helper

Returns the Supabase auth user if the caller is an admin OR a member of the `safety` equipe; returns `null` otherwise. Lives alongside `requireAdminUser` in `lib/admin-auth.ts` (same file, same scope).

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/lib/admin-auth.ts`
- Test: `/Users/heizen/DEV/maia-app/tests/unit/investigacao-permissions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/investigacao-permissions.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const getUserMock      = vi.fn();
const fromMock         = vi.fn();
const getSupabaseServer = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => getSupabaseServer(),
}));

beforeEach(() => {
  getUserMock.mockReset();
  fromMock.mockReset();
  getSupabaseServer.mockReset();
  getSupabaseServer.mockResolvedValue({
    auth: { getUser: getUserMock },
    from: fromMock,
  });
});

function mockUsuariosLookup(profile: { administrador: boolean; equipe_codigos: string[] } | null) {
  fromMock.mockImplementation((table: string) => {
    if (table === "usuarios") {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: profile && {
                administrador: profile.administrador,
                equipe_usuarios: profile.equipe_codigos.map((c) => ({
                  equipes: { codigo: c },
                })),
              },
              error: null,
            }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
}

describe("requireSafetyOrAdmin", () => {
  it("returns null when no user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { requireSafetyOrAdmin } = await import("@/lib/admin-auth");
    expect(await requireSafetyOrAdmin()).toBeNull();
  });

  it("returns the user when admin only", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockUsuariosLookup({ administrador: true, equipe_codigos: [] });
    const { requireSafetyOrAdmin } = await import("@/lib/admin-auth");
    const result = await requireSafetyOrAdmin();
    expect(result?.id).toBe("u1");
  });

  it("returns the user when safety only", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u2" } } });
    mockUsuariosLookup({ administrador: false, equipe_codigos: ["safety"] });
    const { requireSafetyOrAdmin } = await import("@/lib/admin-auth");
    const result = await requireSafetyOrAdmin();
    expect(result?.id).toBe("u2");
  });

  it("returns the user when both admin and safety", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u3" } } });
    mockUsuariosLookup({ administrador: true, equipe_codigos: ["safety"] });
    const { requireSafetyOrAdmin } = await import("@/lib/admin-auth");
    expect((await requireSafetyOrAdmin())?.id).toBe("u3");
  });

  it("returns null for neither admin nor safety", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u4" } } });
    mockUsuariosLookup({ administrador: false, equipe_codigos: ["oh"] });
    const { requireSafetyOrAdmin } = await import("@/lib/admin-auth");
    expect(await requireSafetyOrAdmin()).toBeNull();
  });

  it("returns null when usuarios lookup misses", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u5" } } });
    mockUsuariosLookup(null);
    const { requireSafetyOrAdmin } = await import("@/lib/admin-auth");
    expect(await requireSafetyOrAdmin()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run tests/unit/investigacao-permissions.test.ts
```

Expected: FAIL with "requireSafetyOrAdmin is not a function" or similar.

- [ ] **Step 3: Implement the helper**

Edit `lib/admin-auth.ts`:

```ts
import { getSupabaseServer } from "@/lib/supabase/server";

export async function requireAdminUser() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: u } = await supabase.from("usuarios").select("administrador").eq("id", user.id).single();
  return u?.administrador ? user : null;
}

export async function requireSafetyOrAdmin() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("usuarios")
    .select("administrador, equipe_usuarios(equipes(codigo))")
    .eq("id", user.id)
    .single();
  if (!profile) return null;
  if (profile.administrador) return user;
  const equipeRows = (profile as { equipe_usuarios?: Array<{ equipes: { codigo: string } | null }> }).equipe_usuarios ?? [];
  const inSafety = equipeRows.some((eu) => eu.equipes?.codigo === "safety");
  return inSafety ? user : null;
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
npx vitest run tests/unit/investigacao-permissions.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/admin-auth.ts tests/unit/investigacao-permissions.test.ts
git commit -m "feat(phase-6): requireSafetyOrAdmin auth helper"
```

---

### Task 7: Safety recipient resolver

Resolves the list of email addresses that should receive the "nova ocorrência" notification. Queries members of the `safety` equipe (active users only); falls back to admins if the equipe has no active members. Dedupes. Pure-data helper, easy to test.

**Files:**
- Create: `/Users/heizen/DEV/maia-app/lib/safety-notify.ts`
- Test: `/Users/heizen/DEV/maia-app/tests/unit/safety-notify.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/safety-notify.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { resolveSafetyRecipients } from "@/lib/safety-notify";

function fakeAdmin(rows: { safety: Array<{ email: string }>; admins: Array<{ email: string }> }) {
  return {
    from: (table: string) => {
      if (table === "usuarios") {
        return {
          select: () => ({
            eq: (col: string, val: string) => ({
              eq: () => ({
                in: () => ({ data: rows.safety.length ? rows.safety : null, error: null }),
              }),
              data: col === "administrador" && val === "true" ? rows.admins : null,
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("resolveSafetyRecipients", () => {
  it("returns active safety equipe members when present", async () => {
    const admin = {
      rpc: async () => ({ data: null, error: null }),
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              data: [{ email: "a@x.com" }, { email: "b@x.com" }],
              error: null,
            }),
          }),
        }),
      }),
    };
    // Use the explicit two-query implementation:
    vi.spyOn(admin, "from");
    const out = await resolveSafetyRecipients(
      // We pass in a minimal mock instead of an actual client.
      {
        getSafetyEmails: async () => ["a@x.com", "b@x.com", "a@x.com"],
        getAdminEmails: async () => ["fallback@x.com"],
      },
    );
    expect(out.sort()).toEqual(["a@x.com", "b@x.com"]);
  });

  it("falls back to admins when safety equipe is empty", async () => {
    const out = await resolveSafetyRecipients({
      getSafetyEmails: async () => [],
      getAdminEmails:  async () => ["admin@x.com", "admin2@x.com"],
    });
    expect(out.sort()).toEqual(["admin2@x.com", "admin@x.com"]);
  });

  it("dedupes admin fallback", async () => {
    const out = await resolveSafetyRecipients({
      getSafetyEmails: async () => [],
      getAdminEmails:  async () => ["admin@x.com", "admin@x.com"],
    });
    expect(out).toEqual(["admin@x.com"]);
  });

  it("returns empty when neither source has rows", async () => {
    const out = await resolveSafetyRecipients({
      getSafetyEmails: async () => [],
      getAdminEmails:  async () => [],
    });
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run tests/unit/safety-notify.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the resolver**

Create `lib/safety-notify.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface RecipientSources {
  getSafetyEmails: () => Promise<string[]>;
  getAdminEmails:  () => Promise<string[]>;
}

/** Resolve recipients: active safety equipe members, falling back to active admins. Dedupes. */
export async function resolveSafetyRecipients(sources: RecipientSources): Promise<string[]> {
  const safety = await sources.getSafetyEmails();
  const list   = safety.length ? safety : await sources.getAdminEmails();
  return Array.from(new Set(list));
}

/** Production sources backed by the service-role Supabase client. */
export function makeSupabaseRecipientSources(
  admin: SupabaseClient<Database>,
): RecipientSources {
  return {
    async getSafetyEmails() {
      const { data, error } = await admin
        .from("equipe_usuarios")
        .select("usuarios!inner(email, ativo), equipes!inner(codigo)")
        .eq("equipes.codigo", "safety")
        .eq("usuarios.ativo", true);
      if (error || !data) return [];
      return data
        .map((r) => (r.usuarios as unknown as { email: string }).email)
        .filter(Boolean);
    },
    async getAdminEmails() {
      const { data, error } = await admin
        .from("usuarios")
        .select("email")
        .eq("administrador", true)
        .eq("ativo", true);
      if (error || !data) return [];
      return data.map((r) => r.email).filter(Boolean);
    },
  };
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
npx vitest run tests/unit/safety-notify.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/safety-notify.ts tests/unit/safety-notify.test.ts
git commit -m "feat(phase-6): safety-team recipient resolver with admin fallback"
```

---

### Task 8: Email template + registration

A new HTML email rendered by the existing `_layout` / `_record-table` helpers, plus a row in the `TEMPLATES` registry in `lib/mail/send.ts`.

**Files:**
- Create: `/Users/heizen/DEV/maia-app/emails/ocorrencia-nova-para-safety.ts`
- Modify: `/Users/heizen/DEV/maia-app/lib/mail/send.ts`

- [ ] **Step 1: Write the template**

Create `emails/ocorrencia-nova-para-safety.ts`:

```ts
import { layout } from "./_layout";
import { recordTable } from "./_record-table";

export type OcorrenciaParaSafetyEmail = {
  ocorrencia_id:   string;
  tipo:            string;
  data_ocorrencia: string;
  empresa_nome:    string;
  unidade_nome:    string;
  descricao:       string;
  base_url:        string; // e.g. process.env.APP_URL
};

export function ocorrenciaNovaParaSafety(data: { o: OcorrenciaParaSafetyEmail }): string {
  const { o } = data;
  const link = `${o.base_url}/ocorrencias/${o.ocorrencia_id}/investigacao`;
  const body = `
    <p style="margin:16px 0;">Uma nova ocorrência foi registrada e a investigação está pendente.</p>
    ${recordTable([
      { label: "Tipo",      value: o.tipo },
      { label: "Data",      value: o.data_ocorrencia },
      { label: "Empresa",   value: o.empresa_nome },
      { label: "Unidade",   value: o.unidade_nome },
      { label: "Descrição", value: o.descricao },
    ])}
    <p style="margin:24px 0;">
      <a href="${link}" style="background:#1f2937;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">
        Abrir investigação
      </a>
    </p>
  `;
  return layout("Nova ocorrência registrada — investigação pendente", body);
}
```

- [ ] **Step 2: Register the template**

Edit `lib/mail/send.ts`. Add the import and an entry in `TEMPLATES`:

```ts
import { ocorrenciaNovaParaSafety } from "@/emails/ocorrencia-nova-para-safety";
```

```ts
const TEMPLATES = {
  // ... existing entries ...
  "ocorrencia-receipt":             { subject: "Recebemos sua ocorrência",                            render: ocorrenciaReceipt },
  "ocorrencia-nova-para-safety":    { subject: "Nova ocorrência registrada — investigação pendente",  render: ocorrenciaNovaParaSafety },
} as const;
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors. The new template key `"ocorrencia-nova-para-safety"` should be assignable to `TemplateKey`.

- [ ] **Step 4: Commit**

```bash
git add emails/ocorrencia-nova-para-safety.ts lib/mail/send.ts
git commit -m "feat(phase-6): email template for safety-team ocorrência notification"
```

---

# Section C — Admin config

### Task 9: Admin routes — `investigacao_categorias`

Four handlers (GET list + POST create, PATCH update + DELETE with jsonb pre-check). Mirrors the Phase 5 `afastamento-tipos` route pair exactly, plus a custom DELETE pre-check that scans `investigacoes.dados` jsonb for in-use categorias.

**Files:**
- Create: `/Users/heizen/DEV/maia-app/app/api/admin/investigacao/categorias/route.ts`
- Create: `/Users/heizen/DEV/maia-app/app/api/admin/investigacao/categorias/[id]/route.ts`
- Test: `/Users/heizen/DEV/maia-app/tests/unit/investigacao-jsonb-fk-check.test.ts`

- [ ] **Step 1: Write the failing test for the jsonb pre-check shape**

Create `tests/unit/investigacao-jsonb-fk-check.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCategoriaInUseQuery, buildGrauInUseQuery } from "@/lib/investigacao-fk-check";

describe("buildCategoriaInUseQuery", () => {
  it("builds the @> contains predicate for categoria_id", () => {
    const { sql, params } = buildCategoriaInUseQuery("cat-uuid");
    expect(sql).toContain("dados -> 'ishikawa' @>");
    expect(sql).toContain("jsonb_build_array");
    expect(sql).toContain("'categoria_id'");
    expect(params).toEqual(["cat-uuid"]);
  });
});

describe("buildGrauInUseQuery", () => {
  it("builds the @> contains predicate for grau_id", () => {
    const { sql, params } = buildGrauInUseQuery("grau-uuid");
    expect(sql).toContain("dados -> 'ishikawa' @>");
    expect(sql).toContain("'grau_id'");
    expect(params).toEqual(["grau-uuid"]);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx vitest run tests/unit/investigacao-jsonb-fk-check.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the FK-check helper**

Create `lib/investigacao-fk-check.ts`:

```ts
/** Returns the SQL + params for "is this categoria referenced by any investigacao?" */
export function buildCategoriaInUseQuery(categoriaId: string) {
  return {
    sql: `
      select 1 from investigacoes
       where dados -> 'ishikawa' @> jsonb_build_array(jsonb_build_object('categoria_id', $1::text))
       limit 1
    `,
    params: [categoriaId],
  };
}

/** Returns the SQL + params for "is this grau referenced by any investigacao?" */
export function buildGrauInUseQuery(grauId: string) {
  return {
    sql: `
      select 1 from investigacoes
       where dados -> 'ishikawa' @> jsonb_build_array(jsonb_build_object('grau_id', $1::text))
       limit 1
    `,
    params: [grauId],
  };
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
npx vitest run tests/unit/investigacao-jsonb-fk-check.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Write the GET/POST handler**

Create `app/api/admin/investigacao/categorias/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const Schema = z.object({
  codigo: z.string().min(1),
  rotulo: z.string().min(2),
  ordem:  z.number().int().min(0).optional(),
  ativo:  z.boolean().optional(),
});

export async function GET() {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("investigacao_categorias").select("*").order("ordem");
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("investigacao_categorias").insert(parsed.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 6: Write the PATCH/DELETE handler with jsonb pre-check**

Create `app/api/admin/investigacao/categorias/[id]/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildCategoriaInUseQuery } from "@/lib/investigacao-fk-check";

const Patch = z.object({
  codigo: z.string().min(1).optional(),
  rotulo: z.string().min(2).optional(),
  ordem:  z.number().int().min(0).optional(),
  ativo:  z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("investigacao_categorias").update(parsed.data).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const admin = getSupabaseAdmin();

  // jsonb pre-check: refuse delete if any investigacao references this categoria_id
  const { sql, params: sqlParams } = buildCategoriaInUseQuery(id);
  const { data: inUse, error: checkErr } = await admin.rpc("execute_sql_returning_one", {
    sql_text: sql,
    sql_params: sqlParams,
  } as never).single();
  // If the RPC is not available, fall back to a direct query via PostgREST filter.
  // Supabase JS does not support raw SQL with bind params directly, so we use a typed alternative:
  //   query `investigacoes` with `contains('dados->ishikawa', [{categoria_id: id}])` semantics.
  // The simplest path is the dedicated `.contains` API on jsonb:
  if (checkErr) {
    // Fallback to typed contains
    const { data: rows } = await admin
      .from("investigacoes")
      .select("id")
      .contains("dados", { ishikawa: [{ categoria_id: id }] })
      .limit(1);
    if (rows && rows.length > 0) {
      return NextResponse.json(
        { error: "Em uso por investigações existentes. Desative em vez de excluir." },
        { status: 409 },
      );
    }
  } else if (inUse) {
    return NextResponse.json(
      { error: "Em uso por investigações existentes. Desative em vez de excluir." },
      { status: 409 },
    );
  }

  const { error } = await admin.from("investigacao_categorias").delete().eq("id", id);
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

> **Implementation note**: the `supabase-js` client does not expose raw SQL with bind params, so the DELETE pre-check uses the typed `.contains()` API on the `dados` jsonb column (`.contains("dados", { ishikawa: [{ categoria_id: id }] })`). The `buildCategoriaInUseQuery` helper from Step 3 stays as a documented reference for the equivalent SQL — useful when reviewing the DELETE-time invariant in psql. If the `rpc` call path errors (which it will on a stock Supabase since `execute_sql_returning_one` isn't defined), the typed fallback runs.

- [ ] **Step 7: Manual smoke test**

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000/admin/investigacao/categorias` (will 404 until Task 11; for now just verify the API). With the dev server running and authenticated as an admin in a separate tab, run:

```bash
curl -s http://localhost:3000/api/admin/investigacao/categorias \
  -H "cookie: $(...)" | jq '.[0]'
```

Expected: returns the 6 seeded categorias rows ordered by `ordem`. (If running unauthenticated, expect 403.)

- [ ] **Step 8: Commit**

```bash
git add app/api/admin/investigacao/categorias lib/investigacao-fk-check.ts tests/unit/investigacao-jsonb-fk-check.test.ts
git commit -m "feat(phase-6): admin routes for investigacao_categorias (with jsonb pre-check)"
```

---

### Task 10: Admin routes — `investigacao_graus`

Same shape as Task 9, but for the `graus` table and the `grau_id` jsonb pre-check.

**Files:**
- Create: `/Users/heizen/DEV/maia-app/app/api/admin/investigacao/graus/route.ts`
- Create: `/Users/heizen/DEV/maia-app/app/api/admin/investigacao/graus/[id]/route.ts`

- [ ] **Step 1: Write the GET/POST handler**

Create `app/api/admin/investigacao/graus/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const Schema = z.object({
  codigo: z.string().min(1),
  rotulo: z.string().min(2),
  ordem:  z.number().int().min(0).optional(),
  ativo:  z.boolean().optional(),
});

export async function GET() {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("investigacao_graus").select("*").order("ordem");
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("investigacao_graus").insert(parsed.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Write the PATCH/DELETE handler**

Create `app/api/admin/investigacao/graus/[id]/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const Patch = z.object({
  codigo: z.string().min(1).optional(),
  rotulo: z.string().min(2).optional(),
  ordem:  z.number().int().min(0).optional(),
  ativo:  z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("investigacao_graus").update(parsed.data).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const admin = getSupabaseAdmin();

  // jsonb pre-check: refuse delete if any investigacao references this grau_id
  const { data: rows } = await admin
    .from("investigacoes")
    .select("id")
    .contains("dados", { ishikawa: [{ grau_id: id }] })
    .limit(1);
  if (rows && rows.length > 0) {
    return NextResponse.json(
      { error: "Em uso por investigações existentes. Desative em vez de excluir." },
      { status: 409 },
    );
  }

  const { error } = await admin.from("investigacao_graus").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/investigacao/graus
git commit -m "feat(phase-6): admin routes for investigacao_graus"
```

---

### Task 11: Admin pages + index link

Two thin pages on top of `<AdminCrudTable>`, plus a new "Investigação" section on the admin index linking to both.

**Files:**
- Create: `/Users/heizen/DEV/maia-app/app/(admin)/admin/investigacao/categorias/page.tsx`
- Create: `/Users/heizen/DEV/maia-app/app/(admin)/admin/investigacao/graus/page.tsx`
- Modify: `/Users/heizen/DEV/maia-app/app/(admin)/admin/page.tsx`

- [ ] **Step 1: Write the categorias page**

Create `app/(admin)/admin/investigacao/categorias/page.tsx`:

```tsx
"use client";
import Link from "next/link";
import { AdminCrudTable } from "@/components/admin/crud-table";

export default function InvestigacaoCategoriasPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/admin" className="hover:text-foreground">Administração</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span className="text-foreground">Investigação</span>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">Categorias</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Categorias de Ishikawa</h1>
      </header>
      <AdminCrudTable
        endpoint="/api/admin/investigacao/categorias"
        resourceLabel="categoria"
        initial={{ codigo: "", rotulo: "", ordem: 0, ativo: true }}
        columns={[
          { key: "codigo", label: "Código" },
          { key: "rotulo", label: "Rótulo" },
          { key: "ordem",  label: "Ordem", type: "number" },
          { key: "ativo",  label: "Ativo", type: "checkbox" },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 2: Write the graus page**

Create `app/(admin)/admin/investigacao/graus/page.tsx`:

```tsx
"use client";
import Link from "next/link";
import { AdminCrudTable } from "@/components/admin/crud-table";

export default function InvestigacaoGrausPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/admin" className="hover:text-foreground">Administração</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span className="text-foreground">Investigação</span>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">Graus</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Graus de severidade</h1>
      </header>
      <AdminCrudTable
        endpoint="/api/admin/investigacao/graus"
        resourceLabel="grau"
        initial={{ codigo: "", rotulo: "", ordem: 0, ativo: true }}
        columns={[
          { key: "codigo", label: "Código" },
          { key: "rotulo", label: "Rótulo" },
          { key: "ordem",  label: "Ordem", type: "number" },
          { key: "ativo",  label: "Ativo", type: "checkbox" },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 3: Add the Investigação section to `/admin` index**

Open `app/(admin)/admin/page.tsx` and add a new card group "Investigação" containing two links: `Categorias de Ishikawa` → `/admin/investigacao/categorias` and `Graus de severidade` → `/admin/investigacao/graus`. Follow the same card pattern the page already uses for "Cadastro" or "Pessoas". (Exact JSX depends on what is already there — keep the existing structure; just add a new section.)

- [ ] **Step 4: Verify visually**

```bash
npm run dev
```

Open `http://localhost:3000/admin/investigacao/categorias`. Expected:
- The page renders the breadcrumb + heading.
- The table shows the 6 seeded categorias.
- Clicking "Novo categoria" opens the Sheet form; submitting creates a row.
- Editing an existing row works; toggling `ativo` works.
- Deleting a categoria works (since no investigacao references it yet).

Repeat for `/admin/investigacao/graus`.

- [ ] **Step 5: Commit**

```bash
git add app/\(admin\)/admin/investigacao app/\(admin\)/admin/page.tsx
git commit -m "feat(phase-6): admin pages for investigacao categorias + graus"
```

---

# Section D — API integration

### Task 12: Auto-create investigacao + notify safety in `POST /api/public/ocorrencias`

Extend the existing public POST so that after the ocorrência insert succeeds, it also (a) inserts an empty `investigacoes` row, (b) resolves safety recipients and dispatches the new email, and (c) writes the corresponding `eventos` rows. Failures in (a), (b), (c) are logged via events but never fail the public submission.

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/app/api/public/ocorrencias/route.ts`

- [ ] **Step 1: Edit the route**

Replace the full contents of `app/api/public/ocorrencias/route.ts` with:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { OcorrenciaInputSchema } from "@/lib/validation/ocorrencia";
import { writeEvento } from "@/lib/eventos";
import { sendMail } from "@/lib/mail/send";
import { resolveSafetyRecipients, makeSupabaseRecipientSources } from "@/lib/safety-notify";
import OCORRENCIA_TIPOS from "@/lib/data/ocorrencia_tipos.json";

const EMPTY_DADOS = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] };

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = OcorrenciaInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  if (!OCORRENCIA_TIPOS.includes(parsed.data.tipo)) {
    return NextResponse.json({ error: "invalid_tipo" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("ocorrencias").insert(parsed.data).select(`
    id,
    empresas!inner(nome),
    unidades!inner(nome)
  `).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeEvento(supabase, { tipoEntidade: "ocorrencia", entidadeId: data.id, evento: "criado" });

  // Auto-create the empty investigacao so the form has a row to PATCH from day 0.
  // Best-effort: a failure here is unusual but should not fail the public submission.
  try {
    await supabase.from("investigacoes").insert({
      ocorrencia_id: data.id,
      dados: EMPTY_DADOS,
      situacao: "em_andamento",
    });
  } catch (err: unknown) {
    await writeEvento(supabase, {
      tipoEntidade: "ocorrencia", entidadeId: data.id, evento: "email_enviado",
      dados: { investigacao_autocreate_failed: String(err) },
    });
  }

  // Author receipt (existing behaviour)
  try {
    await sendMail({
      template: "ocorrencia-receipt",
      to: parsed.data.email_remetente,
      data: { o: {
        tipo: parsed.data.tipo,
        data_ocorrencia: parsed.data.data_ocorrencia,
        empresa_nome: (data.empresas as { nome: string }).nome,
        unidade_nome: (data.unidades as { nome: string }).nome,
        descricao: parsed.data.descricao,
      } },
    });
    await writeEvento(supabase, { tipoEntidade: "ocorrencia", entidadeId: data.id,
      evento: "email_enviado", dados: { template: "ocorrencia-receipt", to: parsed.data.email_remetente } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeEvento(supabase, { tipoEntidade: "ocorrencia", entidadeId: data.id,
      evento: "email_enviado", dados: { template: "ocorrencia-receipt", error: msg } });
  }

  // Safety-team notification (new)
  try {
    const sources = makeSupabaseRecipientSources(supabase);
    const recipients = await resolveSafetyRecipients(sources);
    if (recipients.length > 0) {
      await sendMail({
        template: "ocorrencia-nova-para-safety",
        to: recipients,
        data: { o: {
          ocorrencia_id:   data.id,
          tipo:            parsed.data.tipo,
          data_ocorrencia: parsed.data.data_ocorrencia,
          empresa_nome:    (data.empresas as { nome: string }).nome,
          unidade_nome:    (data.unidades as { nome: string }).nome,
          descricao:       parsed.data.descricao,
          base_url:        process.env.APP_URL ?? "",
        } },
      });
      await writeEvento(supabase, {
        tipoEntidade: "ocorrencia", entidadeId: data.id,
        evento: "ocorrencia_para_safety_enviada",
        dados: { destinatarios: recipients },
      });
    } else {
      await writeEvento(supabase, {
        tipoEntidade: "ocorrencia", entidadeId: data.id,
        evento: "ocorrencia_para_safety_falhou",
        dados: { destinatarios: [], error: "sem_destinatarios" },
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeEvento(supabase, {
      tipoEntidade: "ocorrencia", entidadeId: data.id,
      evento: "ocorrencia_para_safety_falhou",
      dados: { destinatarios: [], error: msg },
    });
  }

  return NextResponse.json({ id: data.id });
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Manual smoke**

Start dev server. Submit a public ocorrência via `/forms/ocorrencias`. Then in Studio (`http://127.0.0.1:54323`):
- Verify a row in `investigacoes` exists with `ocorrencia_id = <new id>`, `situacao = 'em_andamento'`, `dados = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] }`.
- Verify rows in `eventos` for `ocorrencia_para_safety_enviada` (or `_falhou` if recipients are empty in your local seed) and `email_enviado` (author receipt).

If the safety equipe has no active members in local data, the recipient resolver falls back to admins. If there are also no admins (unlikely in a real seed), the event is `_falhou` with `sem_destinatarios`.

- [ ] **Step 4: Commit**

```bash
git add app/api/public/ocorrencias/route.ts
git commit -m "feat(phase-6): auto-create investigacao + safety notification on public ocorrência POST"
```

---

### Task 13: Rewrite `POST /api/ocorrencias/[id]/investigacao`

Validate the new `dados` shape, gate by `requireSafetyOrAdmin`, enforce the finalize gate, emit `investigacao_iniciada` (idempotent) and `investigacao_finalizada` events at the right transitions, and keep the parent ocorrência situacao in sync.

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/app/api/ocorrencias/[id]/investigacao/route.ts`

- [ ] **Step 1: Replace the route body**

Open `app/api/ocorrencias/[id]/investigacao/route.ts` and replace its full contents with:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSafetyOrAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeEvento } from "@/lib/eventos";
import { InvestigacaoDadosSchema, assertFinalizable } from "@/lib/investigacao-dados";

const Body = z.object({
  dados:    InvestigacaoDadosSchema,
  situacao: z.enum(["em_andamento", "finalizada"]).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSafetyOrAdmin();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });

  // If the caller is trying to finalize, run the finalize gate before touching the row.
  if (parsed.data.situacao === "finalizada") {
    try {
      assertFinalizable(parsed.data.dados);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não é possível finalizar.";
      return NextResponse.json({ error: msg }, { status: 422 });
    }
  }

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
  if (error?.code === "23503") {
    // Parent ocorrência was deleted between the page load and this request.
    return NextResponse.json({ error: "ocorrencia_removida" }, { status: 409 });
  }
  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? "unknown" }, { status: 500 });
  }

  // Parent ocorrência situacao
  const dadosNonEmpty =
    parsed.data.dados.ishikawa.length +
    parsed.data.dados.plano_acao.length +
    parsed.data.dados.participantes.length +
    parsed.data.dados.fotos.length > 0;

  const ocorrenciaSituacao =
    targetSituacao === "finalizada"
      ? "concluida"
      : (dadosNonEmpty ? "em_investigacao" : "aberta");
  await admin.from("ocorrencias").update({ situacao: ocorrenciaSituacao }).eq("id", id);

  // Emit investigacao_iniciada idempotently: only if dados is non-empty AND no prior event.
  if (dadosNonEmpty) {
    const { count } = await admin
      .from("eventos")
      .select("id", { count: "exact", head: true })
      .eq("tipo_entidade", "investigacao")
      .eq("entidade_id", row.id)
      .eq("evento", "investigacao_iniciada");
    if ((count ?? 0) === 0) {
      await writeEvento(admin, {
        tipoEntidade: "investigacao", entidadeId: row.id,
        evento: "investigacao_iniciada", autorId: user.id,
      });
    }
  }

  if (targetSituacao === "finalizada") {
    await writeEvento(admin, {
      tipoEntidade: "investigacao", entidadeId: row.id,
      evento: "investigacao_finalizada", autorId: user.id,
    });
  }

  return NextResponse.json(row);
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Manual smoke**

Open an existing ocorrência's investigation page (e.g., `/ocorrencias/<id>/investigacao`). Save a draft with one ishikawa branch + one plano_acao row. Verify:
- The row in `investigacoes` updates with the new dados.
- `eventos` shows `investigacao_iniciada` exactly once even after multiple saves.
- Parent ocorrência situacao moves to `em_investigacao`.

Click Finalizar. Verify:
- `eventos` shows `investigacao_finalizada`.
- Parent ocorrência situacao moves to `concluida`.

Try Finalizar with empty plano_acao — expect a 422 response with "Para finalizar, registre ao menos um item no plano de ação."

- [ ] **Step 4: Commit**

```bash
git add app/api/ocorrencias/\[id\]/investigacao/route.ts
git commit -m "feat(phase-6): rewrite investigacao POST with new dados schema + finalize gate"
```

---

### Task 14: Foto upload route + preview rename

Two changes that go together: a new private upload route for fotos, and a rename of the Phase 5 preview route to a private path that also accepts the `investigacoes/` prefix (with the old path kept as a thin re-export for one release).

**Files:**
- Create: `/Users/heizen/DEV/maia-app/app/api/private/investigacoes/upload/route.ts`
- Create: `/Users/heizen/DEV/maia-app/app/api/private/anexos/preview/route.ts`
- Modify: `/Users/heizen/DEV/maia-app/app/api/public/afastamentos/upload/preview/route.ts`

- [ ] **Step 1: Write the foto upload route**

Create `app/api/private/investigacoes/upload/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { requireSafetyOrAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_BYTES = 5 * 1024 * 1024;          // 5 MB per spec
const MAX_FOTOS_PER_INVESTIGACAO = 10;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  const user = await requireSafetyOrAdmin();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  const ocorrenciaId = form.get("ocorrencia_id");
  if (!(file instanceof File) || typeof ocorrenciaId !== "string") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large", max_bytes: MAX_BYTES }, { status: 413 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "invalid_mime", allowed: [...ALLOWED_MIME] }, { status: 415 });
  }

  const admin = getSupabaseAdmin();

  // Enforce 10-foto cap by reading current dados.fotos.length
  const { data: inv, error: invErr } = await admin
    .from("investigacoes")
    .select("dados")
    .eq("ocorrencia_id", ocorrenciaId)
    .single();
  if (invErr || !inv) {
    return NextResponse.json({ error: "investigacao_not_found" }, { status: 404 });
  }
  const fotos = (inv.dados as { fotos?: unknown[] } | null)?.fotos ?? [];
  if (Array.isArray(fotos) && fotos.length >= MAX_FOTOS_PER_INVESTIGACAO) {
    return NextResponse.json({ error: "max_fotos_reached", max: MAX_FOTOS_PER_INVESTIGACAO }, { status: 409 });
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `investigacoes/${ocorrenciaId}/${randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await admin.storage
    .from("attachments")
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }
  return NextResponse.json({ path });
}
```

- [ ] **Step 2: Write the renamed private preview route**

Create `app/api/private/anexos/preview/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const SIGNED_URL_TTL_SECONDS = 60;
const ALLOWED_PREFIXES = ["afastamentos/", "investigacoes/"];

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const path = req.nextUrl.searchParams.get("path");
  if (!path || !ALLOWED_PREFIXES.some((p) => path.startsWith(p))) {
    return NextResponse.json({ error: "bad_path" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from("attachments")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? "not_found" }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
```

- [ ] **Step 3: Make the old preview route a thin re-export**

Replace the full contents of `app/api/public/afastamentos/upload/preview/route.ts` with:

```ts
// Deprecated path retained for one release after Phase 6 to avoid breaking
// any links cached in client state. The new canonical path is
// /api/private/anexos/preview which additionally accepts the investigacoes/ prefix.
export { GET } from "@/app/api/private/anexos/preview/route";
```

- [ ] **Step 4: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Manual smoke**

Start dev server. Hit the renamed route with an authenticated session:

```bash
curl -i "http://localhost:3000/api/private/anexos/preview?path=afastamentos/staging/<existing-file>" \
  -H "cookie: $(...)"
```

Expected: 307/302 redirect to a signed URL. Try with `path=investigacoes/<any>` — same. Try without auth — 401. Try with `path=outroprefixo/foo` — 400. Try the legacy path `/api/public/afastamentos/upload/preview?path=afastamentos/...` — still works (re-export).

- [ ] **Step 6: Commit**

```bash
git add app/api/private app/api/public/afastamentos/upload/preview/route.ts
git commit -m "feat(phase-6): private foto upload + preview rename with afastamentos+investigacoes prefixes"
```

---

# Section E — UI components

### Task 15: `<IshikawaBranchEditor>` + `<ActionItemEditor>`

Two small client components used inside `<InvestigacaoForm>`. Each takes a row from the form state, exposes inputs, and reports changes upward via `onChange` props (the form owns the array of rows). Both are pure presentational + state-projection; no fetches.

**Files:**
- Create: `/Users/heizen/DEV/maia-app/components/investigacoes/ishikawa-branch-editor.tsx`
- Create: `/Users/heizen/DEV/maia-app/components/investigacoes/action-item-editor.tsx`

- [ ] **Step 1: Write `<IshikawaBranchEditor>`**

Create `components/investigacoes/ishikawa-branch-editor.tsx`:

```tsx
"use client";
import * as React from "react";
import { Trash2Icon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type IshikawaBranch = {
  categoria_id: string;
  grau_id: string | null;
  causas: string[];
};

interface Props {
  branch:    IshikawaBranch;
  categoriaRotulo: string;
  graus:     Array<{ id: string; rotulo: string }>;
  onChange:  (next: IshikawaBranch) => void;
  /** Whether to render fully read-only (e.g. categoria was deactivated/removed). */
  readOnly?: boolean;
  readOnlyLabel?: string;
}

export function IshikawaBranchEditor({
  branch, categoriaRotulo, graus, onChange, readOnly, readOnlyLabel,
}: Props) {
  function setGrau(id: string) {
    onChange({ ...branch, grau_id: id || null });
  }
  function setCausa(idx: number, text: string) {
    const next = [...branch.causas];
    next[idx] = text;
    onChange({ ...branch, causas: next });
  }
  function addCausa() {
    onChange({ ...branch, causas: [...branch.causas, ""] });
  }
  function removeCausa(idx: number) {
    onChange({ ...branch, causas: branch.causas.filter((_, i) => i !== idx) });
  }

  return (
    <section className="rounded-md border border-[var(--color-border)] bg-white p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{categoriaRotulo}</h3>
        {readOnly ? (
          <span className="text-xs text-[var(--color-fg-muted)]">{readOnlyLabel}</span>
        ) : null}
      </header>

      <div className="mb-3 flex items-center gap-3">
        <Label htmlFor={`grau-${branch.categoria_id}`} className="w-20 shrink-0 text-xs text-[var(--color-fg-muted)]">
          Grau
        </Label>
        <Select
          value={branch.grau_id ?? ""}
          onValueChange={(v) => setGrau(v as string)}
          disabled={readOnly}
        >
          <SelectTrigger id={`grau-${branch.categoria_id}`} className="w-full">
            <SelectValue placeholder="Selecionar grau" />
          </SelectTrigger>
          <SelectContent>
            {graus.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.rotulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ul className="flex flex-col gap-2">
        {branch.causas.map((c, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <Input
              value={c}
              onChange={(e) => setCausa(idx, e.target.value)}
              placeholder="Descreva a causa"
              disabled={readOnly}
            />
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
          </li>
        ))}
      </ul>

      {!readOnly ? (
        <Button
          type="button"
          variant="ghost"
          className="mt-3"
          onClick={addCausa}
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          Adicionar causa
        </Button>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Write `<ActionItemEditor>`**

Create `components/investigacoes/action-item-editor.tsx`:

```tsx
"use client";
import * as React from "react";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PLANO_ACAO_STATUS, planoAcaoStatusLabel } from "@/lib/investigacao-state";

export type ActionItem = {
  acao: string;
  responsavel: string;
  prazo: string;          // YYYY-MM-DD
  status: typeof PLANO_ACAO_STATUS[number];
};

interface Props {
  item:    ActionItem;
  index:   number;
  onChange:(next: ActionItem) => void;
  onRemove:() => void;
}

export function ActionItemEditor({ item, index, onChange, onRemove }: Props) {
  function set<K extends keyof ActionItem>(key: K, value: ActionItem[K]) {
    onChange({ ...item, [key]: value });
  }

  return (
    <section className="rounded-md border border-[var(--color-border)] bg-white p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Ação #{index + 1}</h3>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remover ação">
          <Trash2Icon className="size-4" aria-hidden="true" />
        </Button>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`acao-${index}`}>Ação</Label>
          <Input id={`acao-${index}`} value={item.acao} onChange={(e) => set("acao", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`resp-${index}`}>Responsável</Label>
          <Input id={`resp-${index}`} value={item.responsavel} onChange={(e) => set("responsavel", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`prazo-${index}`}>Prazo</Label>
          <Input id={`prazo-${index}`} type="date" value={item.prazo} onChange={(e) => set("prazo", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`status-${index}`}>Status</Label>
          <Select
            value={item.status}
            onValueChange={(v) => set("status", v as ActionItem["status"])}
          >
            <SelectTrigger id={`status-${index}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLANO_ACAO_STATUS.map((s) => (
                <SelectItem key={s} value={s}>{planoAcaoStatusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add components/investigacoes/ishikawa-branch-editor.tsx components/investigacoes/action-item-editor.tsx
git commit -m "feat(phase-6): IshikawaBranchEditor + ActionItemEditor components"
```

---

### Task 16: `<ParticipanteList>` + `<FotoUploader>`

Two more small client components, the simplest of the four. Participantes is a repeatable two-input row. FotoUploader wraps an `<input type="file">` per the existing public-form upload pattern, talking to the new private upload route.

**Files:**
- Create: `/Users/heizen/DEV/maia-app/components/investigacoes/participante-list.tsx`
- Create: `/Users/heizen/DEV/maia-app/components/investigacoes/foto-uploader.tsx`

- [ ] **Step 1: Write `<ParticipanteList>`**

Create `components/investigacoes/participante-list.tsx`:

```tsx
"use client";
import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Participante = {
  nome: string;
  email: string | null;
};

interface Props {
  items: Participante[];
  onChange: (next: Participante[]) => void;
}

export function ParticipanteList({ items, onChange }: Props) {
  function set(idx: number, partial: Partial<Participante>) {
    const next = items.map((it, i) => (i === idx ? { ...it, ...partial } : it));
    onChange(next);
  }
  function add() {
    onChange([...items, { nome: "", email: null }]);
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((p, idx) => (
        <section key={idx} className="rounded-md border border-[var(--color-border)] bg-white p-4">
          <header className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Participante #{idx + 1}</h3>
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} aria-label="Remover participante">
              <Trash2Icon className="size-4" aria-hidden="true" />
            </Button>
          </header>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`pnome-${idx}`}>Nome</Label>
              <Input id={`pnome-${idx}`} value={p.nome} onChange={(e) => set(idx, { nome: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`pemail-${idx}`}>E-mail (opcional)</Label>
              <Input
                id={`pemail-${idx}`}
                type="email"
                value={p.email ?? ""}
                onChange={(e) => set(idx, { email: e.target.value || null })}
              />
            </div>
          </div>
        </section>
      ))}
      <Button type="button" variant="ghost" onClick={add}>
        <PlusIcon className="size-4" aria-hidden="true" />
        Adicionar participante
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Write `<FotoUploader>`**

Create `components/investigacoes/foto-uploader.tsx`:

```tsx
"use client";
import * as React from "react";
import { toast } from "sonner";
import { Trash2Icon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Foto = {
  path: string;
  legenda: string | null;
};

interface Props {
  ocorrenciaId: string;
  items: Foto[];
  onChange: (next: Foto[]) => void;
  /** Max fotos per investigation (default 10, enforced server-side too). */
  max?: number;
}

const ACCEPT = "image/jpeg,image/png,image/webp";

export function FotoUploader({ ocorrenciaId, items, onChange, max = 10 }: Props) {
  const [busy, setBusy] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function uploadOne(file: File) {
    if (items.length >= max) {
      toast.error(`Máximo de ${max} fotos por investigação.`);
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("ocorrencia_id", ocorrenciaId);
      const res = await fetch("/api/private/investigacoes/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const { path } = await res.json() as { path: string };
      onChange([...items, { path, legenda: null }]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setBusy(false);
    }
  }

  function setLegenda(idx: number, value: string) {
    const next = items.map((it, i) => (i === idx ? { ...it, legenda: value || null } : it));
    onChange(next);
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadOne(f);
          e.target.value = "";
        }}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((foto, idx) => {
          const previewUrl = `/api/private/anexos/preview?path=${encodeURIComponent(foto.path)}`;
          return (
            <figure key={foto.path} className="rounded-md border border-[var(--color-border)] bg-white p-3">
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="block aspect-video overflow-hidden rounded-sm bg-[var(--color-bg-subtle)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt={foto.legenda ?? ""} className="size-full object-cover" />
              </a>
              <div className="mt-2 flex items-center gap-2">
                <Label htmlFor={`leg-${idx}`} className="sr-only">Legenda</Label>
                <Input
                  id={`leg-${idx}`}
                  value={foto.legenda ?? ""}
                  onChange={(e) => setLegenda(idx, e.target.value)}
                  placeholder="Legenda (opcional)"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} aria-label="Remover foto">
                  <Trash2Icon className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </figure>
          );
        })}
      </div>
      <Button
        type="button"
        variant="secondary"
        disabled={busy || items.length >= max}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadIcon className="size-4" aria-hidden="true" />
        {busy ? "Enviando…" : `Adicionar foto (${items.length}/${max})`}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add components/investigacoes/participante-list.tsx components/investigacoes/foto-uploader.tsx
git commit -m "feat(phase-6): ParticipanteList + FotoUploader components"
```

---

### Task 17: `<InvestigacaoForm>` stepper

The orchestrator: 4-step stepper, react-hook-form state, "Salvar rascunho" / "Finalizar" actions, calls into the four editor components. Mirrors the multi-step pattern from the Phase 5 public ocorrência form.

**Files:**
- Create: `/Users/heizen/DEV/maia-app/components/investigacoes/investigacao-form.tsx`

- [ ] **Step 1: Write the form**

Create `components/investigacoes/investigacao-form.tsx`:

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
import { IshikawaBranchEditor } from "./ishikawa-branch-editor";
import { ActionItemEditor } from "./action-item-editor";
import { ParticipanteList } from "./participante-list";
import { FotoUploader } from "./foto-uploader";
import {
  InvestigacaoDadosSchema,
  type InvestigacaoDados,
} from "@/lib/investigacao-dados";

interface Categoria { id: string; codigo: string; rotulo: string; ativo: boolean; }
interface Grau      { id: string; codigo: string; rotulo: string; ativo: boolean; }

interface Props {
  ocorrenciaId: string;
  initialDados: InvestigacaoDados;
  initialSituacao: "em_andamento" | "finalizada";
  categorias: Categoria[];
  graus:      Grau[];
}

const STEPS = ["Ishikawa", "Plano de ação", "Participantes", "Fotos"] as const;

export function InvestigacaoForm({
  ocorrenciaId, initialDados, initialSituacao, categorias, graus,
}: Props) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  const form = useForm<InvestigacaoDados>({
    resolver: zodResolver(InvestigacaoDadosSchema),
    defaultValues: initialDados,
    mode: "onSubmit",
  });

  // Ensure every ACTIVE categoria has a branch slot (without losing branches for deactivated/removed ones)
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
        ...missing.map((c) => ({ categoria_id: c.id, grau_id: null, causas: [] as string[] })),
      ], { shouldDirty: false });
    }
  }, [activeCategorias, form]);

  const planoAcao = useFieldArray({ control: form.control, name: "plano_acao" });

  async function persist(situacao: "em_andamento" | "finalizada") {
    setBusy(true);
    try {
      const dados = form.getValues();
      // Strip ishikawa branches with no causes (they're "empty" slots)
      const cleanDados: InvestigacaoDados = {
        ...dados,
        ishikawa: dados.ishikawa.filter((b) => b.causas.length > 0 && b.causas.every((c) => c.trim().length > 0)),
      };
      const res = await fetch(`/api/ocorrencias/${ocorrenciaId}/investigacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dados: cleanDados, situacao }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast.success(situacao === "finalizada" ? "Investigação finalizada." : "Rascunho salvo.");
      if (situacao === "finalizada") {
        router.push(`/ocorrencias/${ocorrenciaId}`);
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  const categoriaRotulo = React.useCallback((id: string) => {
    return categorias.find((c) => c.id === id)?.rotulo ?? "Categoria removida";
  }, [categorias]);
  const categoriaActive = React.useCallback((id: string) => {
    return categorias.find((c) => c.id === id)?.ativo ?? false;
  }, [categorias]);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void persist(initialSituacao === "finalizada" ? "finalizada" : "em_andamento"); }}
      className="flex flex-col gap-6"
    >
      <Stepper
        current={step}
        steps={STEPS.map((s) => ({ label: s }))}
      />

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
                    onChange={field.onChange}
                    readOnly={!present || !active}
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
                  onRemove={() => planoAcao.remove(idx)}
                />
              )}
            />
          ))}
          <Button
            type="button"
            variant="ghost"
            onClick={() => planoAcao.append({ acao: "", responsavel: "", prazo: "", status: "pendente" })}
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            Adicionar ação
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <Controller
          control={form.control}
          name="participantes"
          render={({ field }) => (
            <ParticipanteList items={field.value} onChange={field.onChange} />
          )}
        />
      ) : null}

      {step === 3 ? (
        <Controller
          control={form.control}
          name="fotos"
          render={({ field }) => (
            <FotoUploader
              ocorrenciaId={ocorrenciaId}
              items={field.value}
              onChange={field.onChange}
            />
          )}
        />
      ) : null}

      <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
            Voltar
          </Button>
          <Button type="button" variant="secondary" disabled={step === STEPS.length - 1 || busy} onClick={() => setStep((s) => s + 1)}>
            Próximo
          </Button>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void persist("em_andamento")}>
            Salvar rascunho
          </Button>
          <Button type="button" disabled={busy} onClick={() => void persist("finalizada")}>
            Finalizar
          </Button>
        </div>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors. If `<Stepper>` props don't match, adjust the `steps` shape to whatever the existing primitive accepts (the Phase 5 stepper uses `{ label }` per item — check `components/detail/stepper.tsx` and align).

- [ ] **Step 3: Commit**

```bash
git add components/investigacoes/investigacao-form.tsx
git commit -m "feat(phase-6): InvestigacaoForm stepper orchestrator"
```

---

### Task 18: Rewrite investigation page + summary + status

Three pieces tied together: rewrite `/ocorrencias/[id]/investigacao/page.tsx` (server) to load categorias/graus and pass them to `<InvestigacaoForm>`; create `<InvestigacaoSummary>` (server) for finalized state; create `<InvestigationStatus>` (server) to replace the Phase 5 `<InvestigationStarter>` on `/ocorrencias/[id]`.

**Files:**
- Rewrite: `/Users/heizen/DEV/maia-app/app/(app)/ocorrencias/[id]/investigacao/page.tsx`
- Create:  `/Users/heizen/DEV/maia-app/components/investigacoes/investigacao-summary.tsx`
- Create:  `/Users/heizen/DEV/maia-app/components/investigacoes/investigation-status.tsx`
- Modify:  `/Users/heizen/DEV/maia-app/app/(app)/ocorrencias/[id]/page.tsx`

- [ ] **Step 1: Rewrite the investigation page**

Replace the contents of `app/(app)/ocorrencias/[id]/investigacao/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DetailHeader } from "@/components/detail/detail-header";
import { StatusPill } from "@/components/data/status-pill";
import { TimelineEvents, type TimelineEventRow } from "@/components/detail/timeline-events";
import { InvestigacaoForm } from "@/components/investigacoes/investigacao-form";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

interface OcorrenciaSummary {
  id: string;
  tipo: string;
  situacao: string;
  data_ocorrencia: string;
  investigacoes: { id: string; situacao: "em_andamento" | "finalizada"; dados: InvestigacaoDados | null }[] | null;
}

const EMPTY_DADOS: InvestigacaoDados = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] };

export default async function InvestigacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const [
    { data: rawRow },
    { data: timelineData },
    { data: categorias },
    { data: graus },
  ] = await Promise.all([
    supabase
      .from("ocorrencias")
      .select("id, tipo, situacao, data_ocorrencia, investigacoes(id, situacao, dados)")
      .eq("id", id)
      .single(),
    supabase
      .from("eventos")
      .select("id, evento, ocorrido_em, usuarios:autor_id(nome)")
      .in("tipo_entidade", ["ocorrencia", "investigacao"])
      .eq("entidade_id", id)
      .order("ocorrido_em", { ascending: false })
      .returns<TimelineEventRow[]>(),
    supabase.from("investigacao_categorias").select("id, codigo, rotulo, ativo, ordem").order("ordem"),
    supabase.from("investigacao_graus").select("id, codigo, rotulo, ativo, ordem").order("ordem"),
  ]);
  if (!rawRow) notFound();
  const row = rawRow as unknown as OcorrenciaSummary;

  const inv = row.investigacoes?.[0];
  const initialDados: InvestigacaoDados = (inv?.dados ?? EMPTY_DADOS) as InvestigacaoDados;
  const initialSituacao = inv?.situacao ?? "em_andamento";

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        breadcrumbs={[
          { label: "Painel", href: "/painel" },
          { label: "Ocorrências", href: "/ocorrencias" },
          { label: ocorrenciaTipoLabel(row.tipo), href: `/ocorrencias/${row.id}` },
          { label: "Investigação" },
        ]}
        title="Investigação"
        meta={
          <>
            <StatusPill domain="ocorrencia" situacao={row.situacao} />
            <span>{ocorrenciaTipoLabel(row.tipo)}</span>
            <span className="font-mono">{new Date(row.data_ocorrencia).toLocaleString("pt-BR")}</span>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <InvestigacaoForm
          ocorrenciaId={row.id}
          initialDados={initialDados}
          initialSituacao={initialSituacao}
          categorias={categorias ?? []}
          graus={graus ?? []}
        />
        <aside className="flex flex-col gap-6">
          <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
              Histórico
            </h2>
            <TimelineEvents rows={timelineData ?? []} tipoEntidade="ocorrencia" />
          </section>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `<InvestigacaoSummary>` (server)**

Create `components/investigacoes/investigacao-summary.tsx`:

```tsx
import { FieldGrid } from "@/components/detail/field-grid";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

interface Props {
  ocorrenciaId: string;
  dados: InvestigacaoDados;
}

export function InvestigacaoSummary({ ocorrenciaId, dados }: Props) {
  const causasCount  = dados.ishikawa.reduce((acc, b) => acc + b.causas.length, 0);
  const acoesAbertas = dados.plano_acao.filter((a) => a.status === "pendente" || a.status === "em_andamento").length;
  const acoesConcl   = dados.plano_acao.filter((a) => a.status === "concluida").length;

  return (
    <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Investigação finalizada
        </h2>
        <Link href={`/ocorrencias/${ocorrenciaId}/investigacao`}>
          <Button variant="secondary" size="sm">Ver investigação</Button>
        </Link>
      </header>
      <FieldGrid
        items={[
          { label: "Causas registradas",  value: String(causasCount) },
          { label: "Ações pendentes",      value: String(acoesAbertas) },
          { label: "Ações concluídas",     value: String(acoesConcl) },
          { label: "Participantes",        value: String(dados.participantes.length) },
          { label: "Fotos",                value: String(dados.fotos.length) },
        ]}
      />
    </section>
  );
}
```

- [ ] **Step 3: Write `<InvestigationStatus>` (server)**

Create `components/investigacoes/investigation-status.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InvestigacaoSummary } from "./investigacao-summary";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

interface Props {
  ocorrenciaId: string;
  investigacao: { situacao: "em_andamento" | "finalizada"; dados: InvestigacaoDados | null } | null;
}

const EMPTY_DADOS: InvestigacaoDados = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] };

export function InvestigationStatus({ ocorrenciaId, investigacao }: Props) {
  const dados = (investigacao?.dados ?? EMPTY_DADOS);
  const isEmpty =
    dados.ishikawa.length + dados.plano_acao.length + dados.participantes.length + dados.fotos.length === 0;

  if (investigacao?.situacao === "finalizada") {
    return <InvestigacaoSummary ocorrenciaId={ocorrenciaId} dados={dados} />;
  }

  return (
    <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
      <header className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Investigação
        </h2>
      </header>
      <p className="mb-4 text-sm text-[var(--color-fg-muted)]">
        {isEmpty
          ? "Ainda não iniciada. Abra a investigação para registrar Ishikawa, ações, participantes e fotos."
          : "Investigação em andamento. Continue de onde parou."}
      </p>
      <Link href={`/ocorrencias/${ocorrenciaId}/investigacao`}>
        <Button>{isEmpty ? "Iniciar investigação" : "Continuar investigação"}</Button>
      </Link>
    </section>
  );
}
```

- [ ] **Step 4: Replace `<InvestigationStarter>` usage in the ocorrência detail page**

Open `app/(app)/ocorrencias/[id]/page.tsx`. Find the import of `InvestigationStarter` and the JSX that renders it; replace both with `<InvestigationStatus>`. The page already fetches the ocorrência's nested `investigacoes(...)`; pass that single row (or `null`) plus the `id`:

```tsx
import { InvestigationStatus } from "@/components/investigacoes/investigation-status";
// ...
<InvestigationStatus
  ocorrenciaId={row.id}
  investigacao={row.investigacoes?.[0] ?? null}
/>
```

If the page's nested select doesn't yet include `dados` on `investigacoes`, extend it (`investigacoes(id, situacao, dados)`).

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```

Open `/ocorrencias/<an-existing-id>`. Verify:
- For an `em_andamento` investigation with no dados → "Iniciar investigação" CTA.
- For an `em_andamento` investigation with any dados → "Continuar investigação" CTA.
- For a `finalizada` investigation → `<InvestigacaoSummary>` block with the field counts.
- Clicking the CTA opens the investigation page; saving + finalizing routes back to the detail page with `concluida` situacao + the summary block.

- [ ] **Step 6: Commit**

```bash
git add components/investigacoes app/\(app\)/ocorrencias/\[id\]
git commit -m "feat(phase-6): rewrite investigation page + summary + status block on ocorrência detail"
```

---

# Section F — Cleanup & E2E

### Task 19: Delete Phase 5 placeholders

The old `<InvestigationStarter>` and the placeholder `<InvestigacaoForm>` are no longer imported anywhere.

**Files:**
- Delete: `/Users/heizen/DEV/maia-app/components/ocorrencias/investigation-starter.tsx`
- Delete: `/Users/heizen/DEV/maia-app/components/ocorrencias/investigacao-form.tsx`

- [ ] **Step 1: Confirm zero references**

```bash
grep -rn "investigation-starter\|InvestigationStarter\|ocorrencias/investigacao-form" /Users/heizen/DEV/maia-app/{app,components,lib,tests,emails}
```

Expected: no matches. If anything still references either file, fix the caller before deleting.

- [ ] **Step 2: Delete**

```bash
rm /Users/heizen/DEV/maia-app/components/ocorrencias/investigation-starter.tsx
rm /Users/heizen/DEV/maia-app/components/ocorrencias/investigacao-form.tsx
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -u components/ocorrencias
git commit -m "chore(phase-6): delete Phase 5 investigation placeholders"
```

---

### Task 20: Playwright happy-path investigation arc

Extend the existing happy-path with one more block, gated by `E2E_INVESTIGACAO=1`. The block opens the most recently created ocorrência's investigation page, fills one Ishikawa branch + one plano-de-ação row + one participante, skips fotos, finalizes, and verifies the parent is `concluida`.

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/tests/e2e/happy-path.spec.ts`

- [ ] **Step 1: Add the investigation block**

Open `tests/e2e/happy-path.spec.ts`. Append a new `test.describe` block at the end:

```ts
test.describe("Phase 6 investigation", () => {
  test.skip(!process.env.E2E_INVESTIGACAO, "set E2E_INVESTIGACAO=1 to run");

  test("OH admin finalizes Ishikawa investigation end-to-end", async ({ page }) => {
    // Pre-condition: signed in as OH admin and a public ocorrência has just been submitted
    //                (the previous happy-path test does this).

    // 1. Navigate to the most recent ocorrência via the list
    await page.goto("/ocorrencias");
    const firstRow = page.getByRole("link", { name: /Ver detalhes/i }).first();
    await firstRow.click();
    await expect(page).toHaveURL(/\/ocorrencias\/[a-f0-9-]+$/);

    // 2. Click "Iniciar investigação"
    await page.getByRole("link", { name: /Iniciar investigação|Continuar investigação/ }).click();
    await expect(page).toHaveURL(/\/investigacao$/);

    // 3. Step 1 — fill the first Ishikawa branch
    await page.getByRole("button", { name: /Adicionar causa/i }).first().click();
    await page.getByPlaceholder("Descreva a causa").first().fill("Falta de procedimento");
    // grau: pick the first option
    await page.getByLabel(/Grau/i).first().click();
    await page.getByRole("option", { name: /Alto|Médio|Baixo/ }).first().click();

    // 4. Step 2 — plano de ação
    await page.getByRole("button", { name: /Próximo/i }).click();
    await page.getByRole("button", { name: /Adicionar ação/i }).click();
    await page.getByLabel("Ação").fill("Atualizar procedimento padrão");
    await page.getByLabel("Responsável").fill("João Equipe");
    await page.getByLabel("Prazo").fill("2026-12-31");
    // status defaults to pendente

    // 5. Step 3 — participantes
    await page.getByRole("button", { name: /Próximo/i }).click();
    await page.getByRole("button", { name: /Adicionar participante/i }).click();
    await page.getByLabel("Nome").fill("Maria Equipe");

    // 6. Skip fotos, finalize
    await page.getByRole("button", { name: /Finalizar/i }).click();
    await expect(page).toHaveURL(/\/ocorrencias\/[a-f0-9-]+$/);

    // 7. Verify parent ocorrência is concluida + summary renders
    await expect(page.getByText("Concluída")).toBeVisible();
    await expect(page.getByText("Investigação finalizada")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run it locally (optional, gated)**

```bash
E2E_INVESTIGACAO=1 E2E_BASE_URL=http://localhost:3000 npx playwright test happy-path
```

If env credentials are unavailable locally, the test will skip without env var or fail on auth — that's expected outside a seeded env. The check that matters now is the structural one: file parses, selectors are syntactically valid.

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/happy-path.spec.ts
git commit -m "test(phase-6): gated happy-path arc for Ishikawa investigation finalize"
```

---

### Task 21: Mark Phase 6 complete in the umbrella spec

Final administrative step — the umbrella spec at `docs/superpowers/specs/2026-05-14-feature-expansion-design.md` tracks each phase's status. Update Phase 6 to Complete with the commit range.

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/docs/superpowers/specs/2026-05-14-feature-expansion-design.md`

- [ ] **Step 1: Find the commit range**

```bash
git log --oneline | head -25
```

Note the first and last Phase 6 commit shas (e.g., `<first>..<last>`).

- [ ] **Step 2: Edit the umbrella spec**

Open `docs/superpowers/specs/2026-05-14-feature-expansion-design.md`. Under `### Phase 6 — Ishikawa investigation (DB-backed template)`, change the status line:

```markdown
**Status:** ✅ Complete (commit range: <first>..<last>).
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-05-14-feature-expansion-design.md
git commit -m "docs(phase-6): mark Phase 6 complete in umbrella spec"
```

---

# Self-Review Checklist (run after all tasks pass)

This is a final pass before declaring Phase 6 done:

1. **All success criteria met** (per spec §9):
   - [ ] Investigation page renders 4-step stepper driven by `investigacao_categorias` / `investigacao_graus` rows (not JSON).
   - [ ] Safety-team admin can finalize an investigation; parent ocorrência transitions to `concluida`.
   - [ ] Public ocorrência POST triggers the safety email; corresponding event row exists.
   - [ ] Admin can add a categoria; it appears in the next investigation form.
   - [ ] Deleting an in-use categoria returns 409 with the friendly message.
   - [ ] Fotos are only accessible via the auth-gated `/api/private/anexos/preview` route.
   - [ ] Happy-path E2E passes; `E2E_INVESTIGACAO=1` happy-path arc passes against a seeded env.

2. **Radius rule honored**: grep new files for `rounded-full`. Expected: only on avatar/dot uses if any (none in this phase).

3. **No new `lib/data/*.json` entries**: `ls lib/data/` is unchanged from before Phase 6 (still cids.json, ishikawa.json, ocorrencia_tipos.json, ufs.json — all stubs).

4. **Migration applied to staging**: maia-db migration `015_…` ran on staging before maia-app deploy. Verify with `\d investigacao_categorias` in staging psql.

5. **safety equipe seeded**: ENGEKO admin has populated `safety` members via `/admin/equipes` (manual deploy step 3). If empty, the fallback to admins keeps everything functional.

6. **Old preview path still works** for one release: `curl /api/public/afastamentos/upload/preview?path=afastamentos/...` redirects to a signed URL.

---

## Risks Register

(Same as spec §11, transposed for the implementer's reference.)

- *Safety equipe empty at deploy*: admin fallback covers correctness; nag ENGEKO admin to populate.
- *5 MB foto cap pushback*: one-line change in `app/api/private/investigacoes/upload/route.ts` (`MAX_BYTES`).
- *jsonb FK drift*: form falls back to read-only "categoria removida"/"categoria desativada" labels — see `<IshikawaBranchEditor>` props.
- *Old preview path retired*: Phase 7 deletes `app/api/public/afastamentos/upload/preview/route.ts` after one release.
- *Mass-finalize race*: last write wins on jsonb; second finalize PATCH is idempotent because `situacao` is already `finalizada`.

---

> Plan written 2026-05-14, immediately after the Phase 6 sub-spec. Total tasks: 21 (1 migration + 20 maia-app tasks).
