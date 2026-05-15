# Feature expansion design (post-redesign)

> Umbrella spec for the three phases that follow the frontend redesign (Phases 1–5, completed 2026-05-14). Each phase has its own sub-spec written at the time it is brainstormed in detail; the umbrella locks scope, ordering, and the cross-cutting design principles.

## 1. Problem & goal

The frontend redesign closed the visual gap. Three functional gaps remain:

1. The investigation surface for ocorrências is a 4-text-field placeholder. The safety workflow it should support — Ishikawa root-cause analysis, action plan, participants, photographic evidence — is not modelled.
2. The OH admin has no view of operational health: failed emails, failed Fluig pushes, approval latency, distribution by type. Today this requires reading the Vercel logs or running ad-hoc SQL.
3. Colaboradores are passive: they receive emails but cannot log in to check the status of their own submissions. Every "cadê meu atestado?" call to the SO is avoidable.

Goal: ship the three missing surfaces as independent, sequentially-shipped phases, each on its own spec → plan → release cycle.

## 2. Cross-cutting design principle

Every configurable artifact introduced from here on lives in a maia-db table that is editable through an admin page. **No new entries to `lib/data/*.json`.** The existing stubs (`cids.json`, `ufs.json`, `ocorrencia_tipos.json`, `ishikawa.json`) are migrated to tables when their phase touches them; otherwise they are left alone.

Rationale: future ENGEKO admins (and future client admins, if multi-tenant ever returns) must be able to edit the operational vocabulary — Ishikawa categorias, dashboard thresholds, portal copy, ocorrência tipos — without a developer touching a JSON file and shipping a build. This mirrors how `afastamento_tipos`, `unidades`, and `empresas` are already managed.

Concretely:
- Phase 6 introduces `investigacao_categorias` and `investigacao_graus`.
- Phase 7 introduces a `configuracoes_dashboard` row (single row, jsonb thresholds) editable in `/admin/configuracoes`.
- Phase 8 introduces no fixed new tables for config but persists portal copy strings (greeting, empty-state messages) as rows in the existing `configuracoes` shape rather than hardcoded React strings.

## 3. Constraints & decisions (apply across all three phases)

- **Stack unchanged**: Next.js 16 App Router, React 19, Tailwind v4, shadcn `base-nova` over `@base-ui/react`, Supabase SSR. Same primitives and patterns from Phases 1–5.
- **Phase 5 primitives are the toolbox**: `DataTable`, `FilterRail`, `StatusPill`, `EmptyState`, `DetailHeader`, `FieldGrid`, `AttachmentChip`, `Stepper`, `ApprovalBar`, `TimelineEvents`, `CrudTable`, `PublicFormShell`. Each phase reuses what fits; new primitives are added only when no existing one fits.
- **Radius rule**: cap at `rounded-md`; no `rounded-full` on rectangles. (Existing `rounded-xl` cards from earlier phases are grandfathered.)
- **State-machine discipline**: every new lifecycle is validated in code; no implicit transitions.
- **No new external services** in these three phases. Resend and Supabase remain the only third parties.
- **Type generation**: each phase begins with `supabase gen types typescript --local` after its migration lands, before app changes.

## 4. Phases

### Phase 6 — Ishikawa investigation (DB-backed template)

**Status:** ✅ Complete (maia-app: `479d4e7..92eebd0`; maia-db: `70312bb6..3b53f40`). Includes 6.5 completion pass (causa library, topbar nav, dev seed).

- New tables: `investigacao_categorias`, `investigacao_graus` (admin-editable; seeded with 6Ms and 3 severity levels).
- Rewrite `/ocorrencias/[id]/investigacao` as a 4-step stepper form: Ishikawa branches → Plano de Ação → Participantes → Fotos. Driven by the DB-backed templates.
- Admin: `/admin/investigacao/categorias` and `/admin/investigacao/graus` via existing `CrudTable`.
- Permissions: admin OR member of `safety` equipe (new `requireSafetyOrAdmin` helper).
- Notifications: email-only to safety equipe members (admin fallback) when an ocorrência is registered. New email template `emails/ocorrencia-nova-para-safety.ts`.
- Storage: fotos under `attachments/investigacoes/<ocorrencia_id>/<uuid>-<filename>`; reuse the Phase 5 signed-URL preview (extend its allowlist).
- Closes the placeholder documented in DOCUMENTACAO §17.3.

### Phase 7 — Operational dashboard `/painel/saude`

**Status:** sketch (sub-spec written when its turn comes).

- New page `/painel/saude`, admin-only.
- Cards: emails falhados (24h), pushes Fluig falhados (24h), distribuição de afastamentos por tipo (mês corrente), tempo médio de aprovação OH (P50/P95), anexos por status, ocorrências por situação.
- Aggregation queries live in `lib/dashboard/queries.ts`. No new tables for the cards themselves; one `configuracoes_dashboard` row for thresholds (e.g., "considere lento se aprovação > N horas") editable at `/admin/configuracoes`.
- Reuses `DataTable`, `EmptyState`, `StatusPill`. Adds at most one new primitive: `<MetricCard>` (icon + label + value + sparkline).
- Size: ~60–70% of Phase 5.

### Phase 8 — Self-service portal (colaborador surface)

**Status:** sketch (sub-spec written when its turn comes).

- New auth class: `colaborador`. Entry via `/portal` (login) + `/portal/cadastro` (first-time CPF-to-Supabase-user linking). Auth method (magic link vs OTP) decided at spec time.
- Routes: `/portal/painel`, `/portal/afastamentos`, `/portal/afastamentos/[id]`, `/portal/ocorrencias`, `/portal/ocorrencias/[id]`.
- RLS scope: colaborador sees rows where `cpf = sua.cpf`.
- Portal copy (greetings, empty-state messages, banner text) persisted as `configuracoes` rows, not hardcoded strings, to satisfy §2.
- Size: ~1.2× Phase 5 (heaviest of the three; adds a third user class and new RLS policies).

## 5. Ordering rationale

- **Phase 6 first** — closes a long-standing skeleton (DOCUMENTACAO §17.3 "Investigação completa de ocorrência"), establishes the DB-backed-config pattern with a concrete artifact, and the work is well-bounded.
- **Phase 7 second** — small, useful, low-risk; gives OH admins their first operational visibility without changing any flows.
- **Phase 8 third** — heaviest scope and the only one introducing a new user class. Benefits from patterns settling in 6 and 7 (the `configuracoes` pattern from 7 directly informs portal copy in 8).

Each phase ships independently. The umbrella does not promise all three within any single timebox; it promises that, when each is brainstormed, it adheres to this scope and these principles.

## 6. Out of scope (across all three phases)

Deliberately deferred (same exclusions as the redesign):

- Notification bell backend (UI placeholder ships in Phase 4; backend remains deferred).
- Email template redesign (`emails/*` look-and-feel pass).
- Real ENGEKO palette hex swap.
- Real ENGEKO logo asset.
- Internationalization.
- Dark mode toggle.

Plus three new exclusions specific to this umbrella:

- Anti-virus scanning on uploaded fotos / anexos.
- Cross-investigation aggregation queries beyond what Phase 7 covers.
- Multi-tenant restoration. (Still a non-goal per Phase 1–5; the colaborador surface in Phase 8 stays single-tenant.)

## 7. Success criteria (umbrella-level)

The three phases together earn the umbrella its place when:

1. Every Phase 6/7/8 surface respects §2 — no `lib/data/*.json` entries added; every editable thing is in maia-db with an admin page.
2. An OH admin can complete an Ishikawa investigation end-to-end in a single sitting and the parent ocorrência transitions to `concluida`.
3. An OH admin glancing at `/painel/saude` can identify, within 30 seconds, whether the last 24h had email or Fluig failures.
4. A colaborador can log in via the portal and see the status of their own afastamentos and ocorrências without contacting the SO.
5. Each phase ships its own working Playwright E2E arc and keeps the existing happy-path green.

## 8. Non-goals

- Not a redesign of any Phase 1–5 surface. Phases 6–8 add new surfaces; they do not restyle existing ones.
- Not a data-model rewrite. Each phase adds tables; none alter the core lifecycle of `afastamentos`, `ocorrencias`, or `eventos`.
- Not a performance pass. Existing queries stay; only Phase 7 introduces aggregation queries, and those use straightforward SQL + GIN/btree indexes where needed.
- Not an introduction of background workers or queues. All work remains synchronous within route handlers or one-shot edge functions.

---

> This umbrella spec was written 2026-05-14, immediately after Phase 5 closed. The Phase 6 sub-spec was written the same day. Phase 7 and Phase 8 sub-specs will be written when each phase's brainstorming begins.
