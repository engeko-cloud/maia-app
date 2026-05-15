# Phase 6.5 — completion pass

> Written 2026-05-14, after Phase 6 review surfaced three gaps that prevent the Ishikawa surface from being practically usable: no curated causa library, no topbar discoverability for the new admin pages, and no seed data for exercising the flow. Phase 6.5 closes those before Phase 7 begins.

## 1. Problem & goal

Phase 6 shipped the structural pieces of the Ishikawa investigation surface — categorias, graus, the stepper form, finalize-gate, admin CRUD, safety-team notification — but three operational gaps remain:

1. **No causa library.** The form's Ishikawa step gives the user a list of categorias (the 6Ms) and a free-text "descreva a causa" input. The legacy system shipped ~83 curated causas-per-categoria that gave investigators a starting vocabulary; today's user has to type every causa from scratch.
2. **No topbar discoverability.** `lib/nav.ts` still has the Phase 4 `// TODO (Phase 5)` placeholder. The new `/admin/investigacao/categorias` and `/admin/investigacao/graus` pages only reach via the `/admin` index — they don't appear in the Admin submenu. There is also no top-level entry point for opening a new ocorrência from the authenticated app.
3. **No realistic dev seed.** `014_seed.sql` seeds empresas and unidades only. To exercise Phase 6 (or any other surface) locally, an OH admin must first submit a public form, which is friction nobody wants when iterating.

Goal: close all three with a single migration + a focused set of app changes, on `main`, before opening the Phase 7 brainstorm.

## 2. Workstreams

### 2.1 Causa library

**New table** (maia-db migration `016_investigacao_causas_e_seed.sql`):

```sql
create table investigacao_causas (
  id            uuid primary key default gen_random_uuid(),
  categoria_id  uuid not null references investigacao_categorias(id) on delete restrict,
  texto         text not null,
  ordem         int  not null default 0,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_investigacao_causas_categoria_ordem
  on investigacao_causas(categoria_id, ordem) where ativo;

create trigger trg_investigacao_causas_atualizado
  before update on investigacao_causas
  for each row execute function set_atualizado_em();

alter table investigacao_causas enable row level security;

create policy causas_read_authenticated on investigacao_causas
  for select to authenticated using (true);
create policy causas_write_admin on investigacao_causas
  for all to authenticated
  using     (exists (select 1 from usuarios where id = (select auth.uid()) and administrador))
  with check(exists (select 1 from usuarios where id = (select auth.uid()) and administrador));
```

Note: `on delete restrict` on `categoria_id` is intentional — categorias already have a jsonb in-use pre-check in the admin route; we extend that to also block deletion of a categoria that owns any causa rows. The admin route adds a second pre-check; the FK is a belt-and-suspenders fallback.

**Seed** (in the same migration, idempotent via `on conflict (categoria_id, texto) do nothing` with a partial unique index):

The 83 entries from the legacy system, normalized:

| Legacy `tipo` | New `categoria.codigo` |
|---|---|
| `metodos` | `metodo` |
| `maquinas` | `maquina` |
| `medidas` | `medida` |
| `meio_ambiente` | `meio_ambiente` |
| `materiais` | `material` |
| `mdo` | `mao_de_obra` |

**Reconstructed entries** (the 5 entries from the user-provided list that arrived truncated or corrupted; reviewer should sanity-check before commit):

| Legacy id | Original (corrupted) | Reconstructed |
|---|---|---|
| 13 | `{ tipo: missing, texto: "Acessório inadequado ao uso pretendido" }` | tipo=`maquina` (context: surrounded by maquina entries about acessórios) |
| 24 | `texto: "o executada"` | `"Manutenção não executada"` (context: maquina/maintenance run) |
| 36 | `tipo: missing, texto: "tis utilizados para calibração vencidos"` | tipo=`medida`, texto=`"Padrões utilizados para calibração vencidos"` |
| 47/48 | concatenated entry | id 47: `"Estação de tratamento de água inadequada"` (meio_ambiente); id 48: `"Estação lava olhos/chuveiro de emergência inadequado/ausente"` (meio_ambiente) |
| 60 | `texto: "textas de resistência abaixo do necessário"` | `"Características de resistência abaixo do necessário"` |
| 73 | `texto: "Elevação/içamento/movimentaç�equada"` | `"Elevação/içamento/movimentação inadequada"` |

Final seed row count: 83 (id range 1–83 in legacy; mapped 1:1).

**Partial unique index** to make the seed idempotent without locking real edits:

```sql
create unique index uq_investigacao_causas_seed
  on investigacao_causas(categoria_id, texto);
```

**API** (new):

- `GET  /api/admin/investigacao/causas?categoria_id=…` → list (admin or safety-or-admin? — admin-only for write, but list is needed by the form for any authenticated user via Supabase client read on RLS; so the admin API is write-only)
- `POST /api/admin/investigacao/causas`
- `PATCH /api/admin/investigacao/causas/[id]`
- `DELETE /api/admin/investigacao/causas/[id]` → 409 if any `investigacoes.dados` references it (jsonb `.contains({ ishikawa: [{ causas: [{ causa_id: <id> }] }] })`)

The list-for-the-form path reads directly via the SSR Supabase client in the investigation page server component (RLS gates it). No extra API needed.

**Admin route:**

- `/admin/investigacao/causas` — `AdminCrudTable` with columns `[categoria, texto, ordem, ativo]`. The `categoria` column is a select bound to the active categorias list; `texto` is text; `ordem`/`ativo` standard.

**Investigation form changes:**

- `IshikawaBranchEditor` props gain `causasByCategoria: Record<string /* categoria_id */, Array<{ id: string; texto: string }>>`.
- Each causa row in the editor renders a **combobox** with the categoria's curated causas as suggestions; the user may pick one OR type a custom string. Picked-from-library entries store `{ causa_id, descricao }`; custom entries store `{ descricao }` only.
- Read-only display: if `causa_id` is set, render the library label; otherwise render `descricao` as-is. Both render identically in the summary.

**zod schema** (`lib/investigacao-dados.ts` change):

The existing `CausaSchema` is `{ descricao: string }`. The change is additive — append an optional `causa_id` referencing the library:

```ts
const CausaSchema = z.object({
  causa_id:  z.string().regex(UuidRegex).optional(),
  descricao: z.string().min(1),
});
```

`grau_id` stays on the branch (`IshikawaBranchSchema`) — it is not duplicated onto each causa. Nothing else in the dados shape changes.

**FK pre-check on causa delete:**

```ts
// lib/investigacao-fk-check.ts — add a third builder
export const buildCausaInUseQuery = (admin: SupabaseClient, causaId: string) =>
  admin.from("investigacoes").select("id", { count: "exact", head: true })
    .contains("dados", { ishikawa: [{ causas: [{ causa_id: causaId }] }] });
```

### 2.2 Topbar navigation

`lib/nav.ts` edits:

```diff
- // TODO (Phase 5): add "Novo" submenu under afastamentos and
- // "Investigações" + "Nova" under ocorrencias once their routes exist.
  {
    id: "ocorrencias",
    label: "Ocorrências",
    href: "/ocorrencias",
    items: [
      { label: "Lista", href: "/ocorrencias" },
+     { label: "Nova",  href: "/forms/ocorrencias" },
    ],
  },
  {
    id: "admin",
    ...
    items: [
      { label: "Empresas",                href: "/admin/empresas" },
      { label: "Unidades",                href: "/admin/unidades" },
      { label: "Equipes",                 href: "/admin/equipes" },
      { label: "Usuários",                href: "/admin/usuarios" },
      { label: "Tipos de afastamento",    href: "/admin/afastamento-tipos" },
+     { label: "Categorias de investigação", href: "/admin/investigacao/categorias" },
+     { label: "Graus de severidade",        href: "/admin/investigacao/graus" },
+     { label: "Causas de investigação",     href: "/admin/investigacao/causas" },
      { label: "Configurações",           href: "/admin/configuracoes" },
    ],
  },
```

Afastamentos `Novo` is intentionally deferred to Phase 8 (would just link to `/forms/afastamentos`, low value until the colaborador portal makes "my afastamentos" a thing).

The Admin submenu has been growing; it now has 8 items. Acceptable for now. If it grows past ~10 the submenu should be split into groups — out of scope for 6.5.

### 2.3 Dev seed data

New maia-db migration `016_seed_dev.sql` (separate from the causas migration so the dev-only data can be rolled back independently if ever needed).

**Contents** (all idempotent via fixed UUIDs + `on conflict do nothing`):

- **3 usuarios:**
  - 1 OH admin (matches the existing `E2E_OH_EMAIL` env — re-uses the test account).
  - 1 safety-equipe member (so the safety notification flow has somewhere to land).
  - 1 regular non-admin OH user (read-only).
- **6 colaboradores** spread across the two empresas seeded in `014`, varied unidades.
- **6 afastamentos:**
  - 2 `pendente` (so `/afastamentos/aprovacoes` has rows).
  - 2 `aprovado` with eventos (`criado` → `aprovado` ~1h later, plus `email_enviado` + `fluig_enviado`) — gives the upcoming Phase 7 dashboard real data for "tempo médio de aprovação" computations.
  - 1 `rejeitado` with eventos (`criado` → `rejeitado`).
  - 1 `finalizado` (just to populate the lifecycle endpoint).
- **4 ocorrências:**
  - 1 `aberta` with empty investigacao (CTA path).
  - 2 `em_investigacao`: one with partial dados (Ishikawa filled, plano de ação empty — exercises "Continuar"); one with no dados (a fresh empty investigacao auto-created by the public flow).
  - 1 `concluida` with finalized dados — at least 2 ishikawa branches each with 1–2 causas (mixing `causa_id` and free-text), 2 plano-de-acao items (1 concluida, 1 pendente), 2 participantes, 0 fotos.
- **Associated eventos:** Each afastamento and ocorrência gets the minimum eventos needed to make its timeline render correctly. The finalized investigacao gets an `investigacao_iniciada` event ~1d before and an `investigacao_finalizada` event at "now − 1h".

Fixed UUIDs follow the pattern `00000000-0000-0000-0000-0000<entity-code><n>` (entity-code = `af` for afastamento, `oc` for ocorrencia, etc.) so the seed is self-documenting in pgAdmin/Supabase Studio and rerunnable.

This migration is gated by a comment header `-- DEV SEED — do not apply in production`. In practice it lives in `migrations/` alongside the others; production deploys won't run it because production uses a separate Supabase project with a clean migrations directory at deploy time (per existing maia-db README).

If keeping it as a regular migration is uncomfortable, the alternative is `supabase/seed.sql` (only runs on `supabase db reset`). Spec defaults to a migration file for now because we want the data to persist across `supabase migration up` cycles during day-to-day work.

## 3. Out of scope

- Anti-virus / OCR on fotos (already deferred from Phase 6).
- Causa hierarchy beyond `categoria → causa` (no sub-causas).
- "Cause library" import/export tooling.
- Afastamentos `Novo` topbar entry (deferred to Phase 8).
- Admin submenu grouping/splitting.
- Production seed data (the only seeds shipped to production are the 6 categorias + 3 graus from Phase 6 + the 83 causas from 6.5; everything else in `016_seed_dev` is dev-only).

## 4. Success criteria

1. Admin can browse, edit, deactivate, and delete causas via `/admin/investigacao/causas`; deletion is blocked (409) when the causa is referenced in any `investigacoes.dados`.
2. The investigation form's Ishikawa step shows a combobox of curated causas filtered to each branch's categoria, while still accepting custom free-text causas.
3. Every Phase 6 admin route is reachable from the topbar Admin submenu.
4. After running `supabase migration up` against a fresh local DB, an OH admin can sign in, see populated afastamento and ocorrência lists, open a `concluida` ocorrência and see the finalized investigation summary, and open an `em_investigacao` ocorrência and resume the stepper from partial state.
5. All Phase 6 happy-path Playwright tests (including the gated investigation arc) still pass.

## 5. Tasks (preview — for the plan to expand)

1. Causas migration + seed (maia-db).
2. Regenerate types.
3. Update zod schema for `causa_id`.
4. FK-check builder for causas.
5. Admin API routes for causas (GET/POST/PATCH/DELETE with FK pre-check).
6. Admin page `/admin/investigacao/causas`.
7. Update `/admin` index — add a third tile (CausaIcon) for Causas.
8. Update `IshikawaBranchEditor` — combobox with curated suggestions.
9. Update read-only summary path to honor `causa_id` → library label.
10. `lib/nav.ts` — topbar entries + drop TODO.
11. Dev seed migration (`016_seed_dev.sql`).
12. Unit test: zod schema accepts `causa_id`, FK check for causas.
13. Verify Playwright happy-path still passes; extend the gated investigation arc to pick a causa from the combobox.
14. Self-test: walk the four user journeys from §4 in a fresh `db reset → migration up → next dev` cycle.

---

> Phase 6.5 should land in `main` in one continuous push. There is no Phase 6.5 umbrella entry — the existing umbrella's Phase 6 status line will be amended to note "+ 6.5 completion pass" with the final commit SHA range.
