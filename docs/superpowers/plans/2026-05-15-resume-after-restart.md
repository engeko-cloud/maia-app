# Resume After Mac Restart — 2026-05-15

> **Why this file exists:** Docker Desktop wedged mid-session and required a Mac restart. This captures exactly where work stopped, what's committed, and what to do first when resuming.

---

## TL;DR — Next steps when you're back

1. Open Docker Desktop, wait for "Engine running" indicator.
2. `cd /Users/heizen/DEV/maia-db && git checkout consolidate-migrations && make db-reset`
3. If it succeeds: regen types, verify maia-app tsc, then merge the branch.
4. If it fails: debug, amend the commit on the `consolidate-migrations` branch, repeat.

Full details below.

---

## Section A — Investigation flow (FINISHED, MERGED to main)

**Status:** DONE. All 17 task commits + 1 merge commit + 1 lint cleanup commit + dev email override are on `main`.

**On `main` (HEAD = `c2745f3`):**
```
c2745f3 chore(test): exclude .claude/ worktrees from vitest discovery
4cdd99d Merge branch 'worktree-feat-investigacao-flow' — investigacao flow + dev mail override
f5dea71 feat(mail): dev email override — route all sends to lucas@fapptory.me in non-production
9fd6b32 docs(plan): relatorios export implementation plan
f37b60f chore(types): regen Supabase types (includes investigacoes workflow columns)
242bc29 feat(public): status pages, ocorrencias-disponiveis API, form-errors, afastamento-tipo-rules
b629fc2 chore(types-cleanup): drop `as never` casts now that database.types covers join + new columns
7e07f0b feat(brand): adopt engeko-logo.png + Fapptory attribution
9f1cbf5 fix(relatorio): add UTF-8 BOM for Excel; guard user.email before send  ← pre-session HEAD
```

**Worktree branch `worktree-feat-investigacao-flow`** still exists at `/Users/heizen/DEV/maia-app/.claude/worktrees/feat-investigacao-flow`. Already merged into main via `--no-ff`. Safe to delete after final regression verification (see Section D).

**Regression status on main (last measured):**
- TypeScript: **0 errors** (down from baseline 14 — the WIP cleanup committed during this session fixed all)
- Vitest: 153/156 pass (3 baseline failures in `portal-login-init.test.ts`, pre-existing)
- Lint: only 1 warning in our new files (React Hook Form `watch()` — intentional pattern)

**Dev email override behavior:** `lib/mail/send.ts` now wraps `Resend.send()` so that when `NODE_ENV !== "production"`, all recipients are replaced with `lucas@fapptory.me` and the real `to` is prepended to the subject as `[DEV → original@example.com] Subject…`. Production unchanged.

---

## Section B — maia-db migration consolidation (DONE on branch, UNVERIFIED)

**Why we did this:** Migration folder was a mess from concurrent agent work — duplicate numbers (014, 015, 016, 018, 019, 020, 021, 022 collisions), 7 orphan untracked migrations that contained 2 critical pieces missing from git (`017_usuarios_trigger.sql`, `020_afastamento_ocorrencias.sql`), and a chain of seed-as-migration files and fixup-on-fixup deltas. The canonical schema is the remote DB; consolidation produces a clean v0.1.0 baseline that recreates the canonical schema from a fresh DB.

### Branch + commit

- **Repo:** `/Users/heizen/DEV/maia-db`
- **Branch:** `consolidate-migrations` (off of `main` HEAD `a36a4c1`)
- **Commit:** `bc31c30 chore(migrations): consolidate to v0.1.0 baseline (18 migrations + seed.sql)`

### Final structure (18 migrations + seed.sql)

| # | File | Contains |
|---|------|----------|
| 001 | `extensions.sql` | pgcrypto + `set_atualizado_em` trigger function |
| 002 | `usuarios.sql` | usuarios table + `handle_new_auth_user` trigger on auth.users |
| 003 | `equipes.sql` | equipes + equipe_usuarios + `is_admin`/`is_in_equipe` helpers + bootstrap rows ('oh', 'safety') |
| 004 | `configuracoes.sql` | singleton config row with portal copy columns folded in |
| 005 | `empresas.sql` | empresas table + 2 real ENGEKO rows (Engenharia codigo_soc=1340076, Serviços codigo_soc=1332035) |
| 006 | `unidades.sql` | unidades table + ~63 real ENGEKO unit rows (001 SEDE, 107 BASF Demarchi, etc.) |
| 007 | `afastamento_tipos.sql` | reference data (acidente, doenca, etc.) |
| 008 | `afastamentos.sql` | **canonical shape — added serial_id (sequence), made colaborador_nome nullable** |
| 009 | `ocorrencias.sql` | **full canonical shape — vítima cols, local cols, atendimento médico cols, BO. situacao check uses 'concluida' not 'finalizada'** |
| 010 | `investigacoes.sql` | **canonical with workflow folded in — token_publico + decision cols + new vocab (em_andamento/em_aprovacao/aprovada/rejeitada/cancelada) + motivo_rejeicao iff rejeitada check + GIN index on dados** |
| 011 | `eventos.sql` | audit log |
| 012 | `eventos_lidos.sql` | per-user read receipts |
| 013 | `storage.sql` | attachments bucket (private) |
| 014 | `rls.sql` | centralized RLS for 002-012 |
| 015 | `investigacao_taxonomy.sql` | categorias (6Ms) + graus (alto/medio/baixo) + 83 curated causas + RLS inline |
| 016 | `configuracoes_dashboard.sql` | table + RLS inline |
| 017 | `colaboradores_portal.sql` | colaboradores (CPF PK, **NO auth.users dep**) + portal_otp_codes + portal_sessions + defense-in-depth RLS |
| 018 | `afastamento_ocorrencias.sql` | 1:1 bind table + RLS inline |

### seed.sql

Dev-only fixtures (idempotent via fixed UUIDs + on-conflict). Run automatically by `supabase db reset` after migrations. **Login credentials for admin app:**
- `admin@seed.local` / `senha_dev_2024` — administrador=true
- `oh@seed.local` / `senha_dev_2024` — in equipe 'oh', not admin
- `safety@seed.local` / `senha_dev_2024` — in equipe 'safety', not admin

Plus: 1 colaborador for portal testing (CPF 11111111111, email colaborador@seed.local), 6 afastamentos covering all situacoes, 4 ocorrencias + 4 investigacoes with varied states.

### What was dropped

- 7 untracked orphan migrations (duplicate numbers from prior renumbering)
- 4 superseded portal/colaborador iterations: `020_colaboradores`, `023_colaboradores_redesign`, `026_portal_custom_auth`, `028_cleanup_stale_portal_auth_user`
- 5 seed-data-as-migrations: `014_seed`, `017_seed_dev`, `021_seed_portal`, `024_seed_portal_v2`, `025_seed_dev_admin`, `027_seed_portal_v3`
- Duplicate-numbered `022_configuracoes_dashboard_rls` (RLS folded into 016)
- `022_investigacoes_workflow` (columns folded into 010)

### Static review status

Done before Docker died. All 20 canonical tables match column-by-column. FK ordering safe. Seed lookups all resolve to reference data. RLS helpers defined before policies use them.

### What's STILL needed

1. **`make db-reset` on `consolidate-migrations` branch** — apply locally to validate end-to-end.
2. If reset fails: debug, fix the file, `git add -A supabase/ && git commit --amend --no-edit`, retry. (Amend OK here since branch is unmerged and unpushed.)
3. If reset succeeds: schema diff vs canonical (compare `\d+ table_name` output or query `information_schema.columns`).
4. **Apply to linked remote** to overwrite remote state: `cd /Users/heizen/DEV/maia-db && supabase db reset --linked --yes` — DESTRUCTIVE to remote DB but user explicitly approved earlier in session. Remote already holds canonical schema; this rewrites it from clean migrations.
5. **Regen types in maia-app**: `cd /Users/heizen/DEV/maia-db && supabase gen types typescript --local > /Users/heizen/DEV/maia-app/lib/supabase/database.types.ts` then `cd /Users/heizen/DEV/maia-app && npx tsc --noEmit | grep -c "error TS"` — expect 0 (down from current 0 baseline; should stay 0).
6. **Merge `consolidate-migrations` → `main`** in maia-db: `git checkout main && git merge consolidate-migrations` (likely fast-forward since main is at `a36a4c1` and consolidation is one commit ahead).
7. Commit regenerated `database.types.ts` in maia-app on main.

---

## Section C — Open task list (in this session's TaskList)

| ID | Subject | Status |
|----|---------|--------|
| 53 | Read all current maia-db migrations | completed |
| 54 | Compose consolidated 001-NNN migration set | completed |
| 55 | Move all seed content to supabase/seed.sql | completed |
| 56 | Verify via make db-reset + schema diff vs canonical | **in_progress — BLOCKED on Docker** |
| 57 | Remove obsolete migrations + commit clean set | completed |
| 58 | Regen types in maia-app and verify tsc passes | pending — needs Section B step 5 |

---

## Section D — Suggested cleanup AFTER everything verifies

Once Section B is fully verified and merged:

1. Delete the worktree branch: `cd /Users/heizen/DEV/maia-app && git worktree remove .claude/worktrees/feat-investigacao-flow && git branch -d worktree-feat-investigacao-flow`. (Or use `ExitWorktree` with `action: "remove"` if you're back in a Claude Code session that created it.)
2. The `/tmp/maia-old-migrations/` directory will be wiped by the restart. That's fine — original migrations are recoverable from git: `git show a36a4c1~1:supabase/migrations/<file>` (or earlier commits).

---

## Known issues / things to watch

1. **Two main commits have ugly messages from my heredoc mistakes:**
   - `b629fc2` — literal `\`as never\`` backslashes in subject
   - `f37b60f` — `Co-Authored-By` line concatenated onto subject

   I deliberately did not amend per project rules (no amend without explicit user request). If you want them fixed, ask in a new session — `git rebase -i HEAD~7` and reword those two will do it. They're local-only, never pushed.

2. **`b08038, 41733a7` baseline portal-login-init tests still fail** — pre-existing, unrelated to any of this session's work. They were failing before we started and continue to.

3. **The remote DB has the canonical schema** the user provided. Section B step 4 will overwrite it with the consolidated migration output. The user explicitly approved this earlier (`supabase db reset --linked --yes` is in their normal workflow), but flag it as the destructive step it is.

4. **`/tmp/maia-old-migrations/`** holds the 36 pre-consolidation migration files for reference but will be wiped by the Mac restart. Not critical — they're recoverable from git history (`a36a4c1~1` and earlier on maia-db `main`).

---

## File paths cheat sheet

- maia-app worktree: `/Users/heizen/DEV/maia-app/.claude/worktrees/feat-investigacao-flow` (branch: `worktree-feat-investigacao-flow`)
- maia-app main: `/Users/heizen/DEV/maia-app` (branch: `main`, HEAD `c2745f3`)
- maia-db: `/Users/heizen/DEV/maia-db` (branch: `consolidate-migrations`, HEAD `bc31c30`; `main` at `a36a4c1`)
- Investigacao plan: `docs/superpowers/plans/2026-05-15-investigacao-flow.md`
- Investigacao spec: `docs/superpowers/specs/2026-05-15-investigacao-flow-design.md`
- This handover: `docs/superpowers/plans/2026-05-15-resume-after-restart.md`
