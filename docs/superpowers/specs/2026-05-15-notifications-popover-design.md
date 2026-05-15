# Notifications Popover + Realtime — Design Spec

**Date:** 2026-05-15

## Overview

Replace the 30-second polling bell (count-only) with a Supabase Realtime subscription and add a popover that lists notification items. Clicking an item opens a dialog and marks it as read in the database.

---

## 1. Schema

New table `eventos_lidos` tracks which events each user has read:

```sql
create table eventos_lidos (
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  evento_id   uuid not null references eventos(id) on delete cascade,
  lido_em     timestamptz not null default now(),
  primary key (usuario_id, evento_id)
);
alter table eventos_lidos enable row level security;
create policy eventos_lidos_self on eventos_lidos for select
  using ((select auth.uid()) = usuario_id);
```

Writes use service-role only (no INSERT policy for users — consistent with the rest of the schema).

---

## 2. API Routes

### `GET /api/notificacoes`
- Authenticates the current user via `getSupabaseServer()`.
- Queries `eventos` (admin client) for the last 20 events in the past 24h where `tipo_entidade IN ('afastamento', 'ocorrencia')`, ordered by `ocorrido_em DESC`.
- Fetches `eventos_lidos` for those event IDs and the current `usuario_id`.
- Returns `Notification[]` with a `lido: boolean` field per item.

### `POST /api/notificacoes/[id]/read`
- Authenticates the current user.
- Upserts `(usuario_id, evento_id)` into `eventos_lidos` via admin client.
- Returns `200 {}`.

### Deleted
- `/api/notificacoes/unread` — removed; unread count is derived from the list.

---

## 3. `useNotifications` Hook

**Location:** `hooks/use-notifications.ts`

```ts
type Notification = {
  id: string
  tipo_entidade: 'afastamento' | 'ocorrencia'
  evento: string
  ocorrido_em: string
  lido: boolean
}
```

**Behaviour:**
- On mount: `GET /api/notificacoes` populates `items`.
- Realtime: opens a Supabase channel via `getSupabaseBrowser()`, subscribes to `postgres_changes` `INSERT` on `eventos` with filter `tipo_entidade=in.(afastamento,ocorrencia)`. New events are prepended as `lido: false`. Channel cleaned up on unmount.
- `markAsRead(id)`: calls `POST /api/notificacoes/[id]/read`, then flips `lido: true` optimistically in local state.
- `markAllAsRead()`: calls `markAsRead` for every unread item in parallel, flips all in state.
- Returns `{ items, unreadCount, markAsRead, markAllAsRead }`.

Instantiated once inside `AppNotificationBell` — no provider needed.

---

## 4. UI Components

### `AppNotificationBell` (`components/layout/app-notification-bell.tsx`)

Full rewrite of the existing file. Calls `useNotifications()`.

- Bell button is the Base UI `Popover.Trigger`.
- Unread dot: small filled circle (brand accent), visible when `unreadCount > 0`.
- Popover panel: ~320px wide, max-height 400px, scrollable list.
  - Header: "Notificações" label + "Marcar tudo lido" button (only when `unreadCount > 0`).
  - List of `NotificationItem` components.
  - Empty state: "Nenhuma notificação recente" in muted text.

### `NotificationItem` (`components/notifications/notification-item.tsx`)

Renders one row:
- Left: small dot (brand accent, transparent when `lido`) for alignment consistency.
- Center: tipo capitalised as muted label + `evento` as main text + relative time via `date-fns formatDistanceToNow`.
- Slightly highlighted background when unread.
- On click: calls `markAsRead(id)` + opens `NotificationDialog`.

### `NotificationDialog` (`components/notifications/notification-dialog.tsx`)

Uses the existing Base UI `Dialog` component.
- Title: tipo_entidade capitalised.
- Body: `evento` text + full formatted `ocorrido_em`.
- Read is marked on click (before dialog opens) — no separate button needed.
- Single "Fechar" button.

No new UI primitives required — `@base-ui/react/popover` is already bundled.

---

## 5. Files Changed / Created

| Action | Path |
|--------|------|
| New migration | `supabase/migrations/XXX_eventos_lidos.sql` (in maia-db repo) |
| New | `app/api/notificacoes/route.ts` |
| New | `app/api/notificacoes/[id]/read/route.ts` |
| Deleted | `app/api/notificacoes/unread/route.ts` |
| New | `hooks/use-notifications.ts` |
| Rewrite | `components/layout/app-notification-bell.tsx` |
| New | `components/notifications/notification-item.tsx` |
| New | `components/notifications/notification-dialog.tsx` |
| Edit (remove `getUnreadCount`) | `lib/dashboard/queries.ts` |
