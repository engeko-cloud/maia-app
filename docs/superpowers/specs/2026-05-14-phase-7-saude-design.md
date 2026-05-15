# Phase 7 — Painel de Saúde Operacional (`/painel/saude`)

> Sub-spec for the umbrella design at `docs/superpowers/specs/2026-05-14-feature-expansion-design.md`.
> Brainstormed 2026-05-14. Phase 7 ships after Phase 6.5 closes.

## 1. Goal

Give OH admins a single page where they can confirm, within 30 seconds, whether the last 24 hours had email or Fluig failures — and see month-level operational KPIs. Simultaneously, activate the notification bell (previously a UI placeholder) with a lightweight polling backend.

## 2. Scope additions vs. umbrella spec

The umbrella spec listed Phase 7 as ~60–70% the size of Phase 5. Two items are added here that were deferred in the umbrella:

- **Notification bell backend** — ships in Phase 7 because the polling architecture introduced for the health dashboard naturally extends to the bell. Keeping it deferred would mean a third polling endpoint in Phase 8 with no additional benefit.
- **`AppTopNav` polling split** — `AppTopNav` is currently a Server Component. The bell must become a self-contained Client Component to poll independently. This is a small, targeted refactor with no user-visible change beyond the bell becoming live.

## 3. Architecture

### Polling model — Approach A (two independent pollers)

The bell and the health dashboard poll different endpoints with different data needs. A shared React context would couple distinct domains; Supabase Realtime is overkill for 30s acceptable lag.

- `GET /api/notificacoes/unread` — returns `{ count: number }`, polled by `AppNotificationBell` every 30s.
- `GET /api/saude` — returns all health metrics, polled by `<SaudeClient>` and `<SaudeBanner>` independently every 30s.

### Page structure

`/painel/saude` is an SSR page that renders an initial snapshot, then mounts `<SaudeClient>` which takes over polling. No loading flash on first render.

`/painel` (existing) mounts a small `<SaudeBanner>` client component that polls `/api/saude` and renders a red alert strip only when `emails_falhados + fluig_falhados > 0`. When all is healthy it returns `null`.

## 4. Data layer

### Existing data — no new instrumentation needed

All required data already exists in the `eventos` table (logged since Phase 1):

| Metric | Query |
|---|---|
| Emails falhados (24h) | `eventos` where `evento = 'email_enviado'` AND `dados->>'error' IS NOT NULL` AND `ocorrido_em > now() - interval '24h'` |
| Fluig falhados (24h) | `eventos` where `evento = 'fluig_erro'` AND `ocorrido_em > now() - interval '24h'` |
| Aprovação P50/P95 | Per-afastamento diff between `criado` and `aprovado` eventos, últimos 30 dias |
| Distribuição por tipo | `afastamentos` JOIN `afastamento_tipos`, mês corrente, grouped by tipo |
| Ocorrências por situação | `ocorrencias` count grouped by `situacao` |
| Anexos por status | `afastamentos` count: with vs. without `arquivo_url` |

For the alert cards with inline lists: the same queries fetch the `entidade_id` (afastamento id) and collaborator name via join, so the list of affected afastamentos is returned alongside the count at no extra cost.

### New table — `configuracoes_dashboard` (maia-db)

Single-row table, jsonb column `config`:

```sql
create table configuracoes_dashboard (
  id          boolean primary key default true check (id),  -- enforces single row
  config      jsonb not null default '{}'::jsonb
);
insert into configuracoes_dashboard (config) values ('{"aprovacao_lenta_horas": 24}');
```

The `aprovacao_lenta_horas` threshold determines when the P50 latency card renders red vs. green. Editable at `/admin/configuracoes` (new section in the existing page, no new route).

### Notification bell — unread count

Definition of "unread": count of `eventos` in the last 24h where `tipo_entidade IN ('afastamento', 'ocorrencia')`. No new table, no per-user read state. The badge disappears when the admin clicks the bell (client-side state reset only). A full read/unread model is deferred to a future phase.

### Aggregation queries location

`lib/dashboard/queries.ts` — new file. Each metric is a named async function accepting a Supabase client. Keeps route handlers thin.

## 5. New files and changes

### New files

| Path | Purpose |
|---|---|
| `lib/dashboard/queries.ts` | Named query functions for each health metric |
| `app/api/saude/route.ts` | `GET /api/saude` — admin-only, returns health metrics JSON |
| `app/api/notificacoes/unread/route.ts` | `GET /api/notificacoes/unread` — returns `{ count: number }` |
| `app/(app)/painel/saude/page.tsx` | SSR page shell + mounts `<SaudeClient>` |
| `components/saude/saude-client.tsx` | Client component, polls `/api/saude` every 30s, renders all cards |
| `components/saude/saude-banner.tsx` | Client component, polls `/api/saude`, conditionally renders alert strip on `/painel` |
| `components/saude/metric-card.tsx` | New primitive: icon + label + value + optional delta + status color strip |

### Modified files

| Path | Change |
|---|---|
| `components/layout/app-notification-bell.tsx` | Add `useInterval` hook, poll `/api/notificacoes/unread` every 30s, manage badge via local state |
| `components/layout/app-top-nav.tsx` | Remove `unread` prop pass to bell (bell is now self-contained) |
| `app/(app)/painel/page.tsx` | Mount `<SaudeBanner>` below the page header |
| `app/(app)/layout.tsx` | No change — bell is self-contained, no provider needed |
| `app/api/admin/configuracoes/route.ts` | Extend `PATCH` handler to accept and persist `aprovacao_lenta_horas` |
| `app/(admin)/admin/configuracoes/page.tsx` | Add "Dashboard" section with numeric input for the threshold |
| `lib/nav.ts` | Add `{ label: "Saúde", href: "/painel/saude" }` to the `admin` group items |

## 6. UI design

### `/painel/saude` layout

Two labelled sections (decision B from brainstorming):

```
┌─ Alertas — última 24h ──────────────────────────────┐
│  [MetricCard: Emails falhados]                       │
│    └─ inline list of affected afastamentos (if > 0) │
│  [MetricCard: Fluig falhados]                        │
│    └─ inline list of affected afastamentos (if > 0) │
└──────────────────────────────────────────────────────┘

┌─ Operacional — mês corrente ─────────────────────────┐
│  [MetricCard: Aprovação P50]  [MetricCard: P95]      │
│  [MetricCard: Ocorrências abertas]                   │
│  [MetricCard: Anexos presentes]                      │
│  [DistribuicaoPorTipo — horizontal CSS bars]         │
└──────────────────────────────────────────────────────┘
```

### `<MetricCard>` primitive

Props: `label`, `value`, `delta?`, `tone: "ok" | "warn" | "error" | "neutral"`, `children?` (for the inline failure list slot). Tone drives the bottom color strip (reuses the strip pattern from `KpiCard`). No new external dependency.

### Distribuição por tipo

CSS-only horizontal bars: `div` with `width` set as inline style percentage. No charting library. Tipo names from `afastamento_tipos` (already admin-editable). Max 8 tipos shown; remainder collapsed to "Outros (N)".

### Alert inline list

When a failure card has `count > 0`, renders a compact list below the value:
- Each row: collaborator name + afastamento tipo + link to `/afastamentos/[id]`
- Max 5 rows shown; if more, "ver todos (N) →" links to a filtered `/afastamentos` list

### Color semantics

| Tone | When |
|---|---|
| `error` (red) | count > 0 (failures), P50 > threshold |
| `ok` (green) | count = 0 (no failures), P50 ≤ threshold |
| `neutral` (blue) | Operational KPIs with no threshold (ocorrências, anexos, distribuição) |

## 7. Error handling

- `/api/saude` and `/api/notificacoes/unread`: non-admin requests → 403. Query failures → 500 with `{ error: "internal" }`. Client components treat non-ok responses by retaining last good data (no flash to zero on transient error).
- `<SaudeClient>` shows a muted "última atualização: HH:MM" timestamp so the admin knows if data is stale.
- `<SaudeBanner>` is silent on error (returns `null`) — a transient polling failure should not cause a false alarm on the main painel.

## 8. Testing

One new Playwright E2E arc: `e2e/phase-7-saude.spec.ts`

Happy path:
1. Admin logs in, navigates to `/painel/saude`.
2. Page renders with two sections.
3. Assert at least one metric card is visible.
4. Assert no red cards when test DB has no failure eventos in last 24h.
5. Assert `/api/saude` returns 403 for a non-admin user.
6. Assert notification bell badge reflects the count from `/api/notificacoes/unread`.

No need to simulate a live 30s poll cycle in E2E — the initial SSR render is the deterministic assertion target.

## 9. Out of scope for Phase 7

- Per-user read/unread state for notifications (full model deferred).
- Retry button for failed Fluig pushes (informational only in this phase).
- Chart library (Recharts, Tremor, etc.) — CSS bars are sufficient.
- Cross-investigation aggregation beyond what the queries above cover.
- Any Phase 1–5 surface restyling.

## 10. Success criteria

- An OH admin at `/painel/saude` can confirm within 30 seconds whether the last 24h had failures.
- Data auto-refreshes every 30s without a page reload.
- The notification bell badge reflects live activity without a page reload.
- `/api/saude` returns 403 for non-admins.
- Existing happy-path E2E arcs remain green.
- `configuracoes_dashboard` threshold is editable at `/admin/configuracoes` and reflected immediately in the P50 card color.
