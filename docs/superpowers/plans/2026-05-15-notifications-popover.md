# Notifications Popover + Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 30-second polling bell with Supabase Realtime and add a popover that lists recent events; clicking an item opens a detail dialog and persists the read state to the DB.

**Architecture:** A `useNotifications` hook in `hooks/use-notifications.ts` owns the Supabase channel and all state. `AppNotificationBell` is rewritten as a thin Base UI Popover shell. `NotificationItem` and `NotificationDialog` are new components in `components/notifications/`. Read state is persisted in a new `eventos_lidos` table written via service-role API routes.

**Tech Stack:** Next.js 16 (App Router), Supabase Realtime (`postgres_changes` INSERT), `@base-ui/react/popover`, `date-fns` v4, TypeScript.

---

## File Map

| Action | Path |
|--------|------|
| Create | `/Users/heizen/DEV/maia-db/supabase/migrations/020_eventos_lidos.sql` |
| Edit | `lib/supabase/database.types.ts` — add `eventos_lidos` table types |
| Create | `app/api/notificacoes/route.ts` |
| Create | `app/api/notificacoes/[id]/read/route.ts` |
| Delete | `app/api/notificacoes/unread/route.ts` |
| Edit | `lib/dashboard/queries.ts` — remove `getUnreadCount` |
| Create | `hooks/use-notifications.ts` |
| Create | `components/notifications/notification-item.tsx` |
| Create | `components/notifications/notification-dialog.tsx` |
| Rewrite | `components/layout/app-notification-bell.tsx` |

---

## Task 1: DB Migration — `eventos_lidos`

**Repo:** `/Users/heizen/DEV/maia-db`

**Files:**
- Create: `supabase/migrations/020_eventos_lidos.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/020_eventos_lidos.sql
create table eventos_lidos (
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  evento_id   uuid not null references eventos(id) on delete cascade,
  lido_em     timestamptz not null default now(),
  primary key (usuario_id, evento_id)
);

alter table eventos_lidos enable row level security;

-- Users may only see their own read receipts.
-- Writes are service-role only (no INSERT policy).
create policy eventos_lidos_self on eventos_lidos for select
  using ((select auth.uid()) = usuario_id);
```

- [ ] **Step 2: Apply the migration**

```bash
# In /Users/heizen/DEV/maia-db
supabase db push
```

Expected: migration applied successfully, no errors.

- [ ] **Step 3: Verify table exists**

```bash
supabase db execute --sql "select table_name from information_schema.tables where table_schema = 'public' and table_name = 'eventos_lidos';"
```

Expected: one row returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/020_eventos_lidos.sql
git commit -m "feat(db): add eventos_lidos read-receipt table"
```

---

## Task 2: Update TypeScript DB Types

**Repo:** `/Users/heizen/DEV/maia-app`

**Files:**
- Edit: `lib/supabase/database.types.ts`

- [ ] **Step 1: Insert `eventos_lidos` block after the `eventos` block (around line 384)**

Find the closing brace of the `eventos` block (ends around line 384 with `}`) and insert the following block immediately after it, before `investigacao_categorias`:

```ts
      eventos_lidos: {
        Row: {
          evento_id: string
          lido_em: string
          usuario_id: string
        }
        Insert: {
          evento_id: string
          lido_em?: string
          usuario_id: string
        }
        Update: {
          evento_id?: string
          lido_em?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_lidos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_lidos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/database.types.ts
git commit -m "feat(types): add eventos_lidos to database types"
```

---

## Task 3: API — `GET /api/notificacoes`

Returns the last 20 events from the past 24h, with `lido: boolean` per item for the authenticated user.

**Files:**
- Create: `app/api/notificacoes/route.ts`

- [ ] **Step 1: Create the route**

```ts
// app/api/notificacoes/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function oneDayAgo() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

export async function GET() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();

  const { data: eventos, error } = await admin
    .from("eventos")
    .select("id, tipo_entidade, evento, ocorrido_em")
    .in("tipo_entidade", ["afastamento", "ocorrencia"])
    .gte("ocorrido_em", oneDayAgo())
    .order("ocorrido_em", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (eventos ?? []).map((e) => e.id);

  const { data: lidos } = ids.length
    ? await admin
        .from("eventos_lidos")
        .select("evento_id")
        .eq("usuario_id", user.id)
        .in("evento_id", ids)
    : { data: [] };

  const lidosSet = new Set((lidos ?? []).map((l) => l.evento_id));

  const items = (eventos ?? []).map((e) => ({
    id: e.id,
    tipo_entidade: e.tipo_entidade,
    evento: e.evento,
    ocorrido_em: e.ocorrido_em,
    lido: lidosSet.has(e.id),
  }));

  return NextResponse.json(items);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/notificacoes/route.ts
git commit -m "feat(api): GET /api/notificacoes — recent events with read status"
```

---

## Task 4: API — `POST /api/notificacoes/[id]/read`

Persists a read receipt for the authenticated user.

**Files:**
- Create: `app/api/notificacoes/[id]/read/route.ts`

- [ ] **Step 1: Create the route**

```ts
// app/api/notificacoes/[id]/read/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("eventos_lidos")
    .upsert({ usuario_id: user.id, evento_id: id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({});
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/notificacoes/[id]/read/route.ts"
git commit -m "feat(api): POST /api/notificacoes/[id]/read — persist read receipt"
```

---

## Task 5: Cleanup — Delete Old Route + `getUnreadCount`

**Files:**
- Delete: `app/api/notificacoes/unread/route.ts`
- Edit: `lib/dashboard/queries.ts`

- [ ] **Step 1: Delete the old unread route**

```bash
rm app/api/notificacoes/unread/route.ts
rmdir app/api/notificacoes/unread
```

- [ ] **Step 2: Remove `getUnreadCount` from `lib/dashboard/queries.ts`**

Delete the following function (around line 202–209):

```ts
export async function getUnreadCount(admin: SupabaseClient): Promise<number> {
  const { data } = await (admin
    .from("eventos")
    .select("id")
    .in("tipo_entidade", ["afastamento", "ocorrencia"])
    .gte("ocorrido_em", oneDayAgo()) as any);
  return (data ?? []).length;
}
```

Also remove the `oneDayAgo()` helper from `queries.ts` **only if it is not used by any other function in the file** — verify with `grep oneDayAgo lib/dashboard/queries.ts` before removing.

- [ ] **Step 3: Verify no remaining references to the deleted code**

```bash
grep -r "notificacoes/unread\|getUnreadCount" app lib components --include="*.ts" --include="*.tsx"
```

Expected: no output.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "chore: remove polling unread route and getUnreadCount"
```

---

## Task 6: `useNotifications` Hook

Owns all state: item list, unread count, realtime subscription, mark-as-read actions.

**Files:**
- Create: `hooks/use-notifications.ts`

- [ ] **Step 1: Create the hook**

```ts
// hooks/use-notifications.ts
"use client";

import * as React from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export type Notification = {
  id: string;
  tipo_entidade: "afastamento" | "ocorrencia";
  evento: string;
  ocorrido_em: string;
  lido: boolean;
};

export function useNotifications() {
  const [items, setItems] = React.useState<Notification[]>([]);

  // Initial fetch
  React.useEffect(() => {
    fetch("/api/notificacoes")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Notification[]) => setItems(data))
      .catch(() => {});
  }, []);

  // Realtime subscription
  React.useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "eventos",
          filter: "tipo_entidade=in.(afastamento,ocorrencia)",
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            tipo_entidade: string;
            evento: string;
            ocorrido_em: string;
          };
          setItems((prev) => [
            {
              id: row.id,
              tipo_entidade: row.tipo_entidade as Notification["tipo_entidade"],
              evento: row.evento,
              ocorrido_em: row.ocorrido_em,
              lido: false,
            },
            ...prev,
          ]);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const markAsRead = React.useCallback((id: string) => {
    fetch(`/api/notificacoes/${id}/read`, { method: "POST" }).catch(() => {});
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lido: true } : n)),
    );
  }, []);

  const markAllAsRead = React.useCallback(() => {
    setItems((prev) => {
      prev.filter((n) => !n.lido).forEach((n) => {
        fetch(`/api/notificacoes/${n.id}/read`, { method: "POST" }).catch(() => {});
      });
      return prev.map((n) => ({ ...n, lido: true }));
    });
  }, []);

  const unreadCount = items.filter((n) => !n.lido).length;

  return { items, unreadCount, markAsRead, markAllAsRead };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-notifications.ts
git commit -m "feat(hook): useNotifications — realtime subscription + read state"
```

---

## Task 7: `NotificationItem` Component

One row in the popover list. Clicking opens the detail dialog and marks as read.

**Files:**
- Create: `components/notifications/notification-item.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/notifications/notification-item.tsx
"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Notification } from "@/hooks/use-notifications";
import { formatEntidadeNoun } from "@/lib/eventos-format";
import type { TipoEntidade } from "@/lib/eventos-format";

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface NotificationItemProps {
  notification: Notification;
  onOpen: (notification: Notification) => void;
}

export function NotificationItem({ notification, onOpen }: NotificationItemProps) {
  const noun = capitalize(
    formatEntidadeNoun(notification.tipo_entidade as TipoEntidade),
  );
  const relative = formatDistanceToNow(new Date(notification.ocorrido_em), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        "flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/60",
        !notification.lido && "bg-[var(--brand-accent-500)]/5",
      )}
    >
      {/* Unread dot — always reserve space for alignment */}
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          notification.lido
            ? "bg-transparent"
            : "bg-[var(--brand-accent-500)]",
        )}
      />
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="font-medium leading-snug truncate">
          {noun}{" "}
          <span className="font-normal text-[var(--color-fg-muted)]">
            {notification.evento}
          </span>
        </span>
        <span className="text-xs text-[var(--color-fg-muted)]">{relative}</span>
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/notifications/notification-item.tsx
git commit -m "feat(ui): NotificationItem — popover row with unread indicator"
```

---

## Task 8: `NotificationDialog` Component

Detail view for a single notification. Displayed when an item is clicked; read is already marked by the caller before this opens.

**Files:**
- Create: `components/notifications/notification-dialog.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/notifications/notification-dialog.tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/hooks/use-notifications";
import { formatEntidadeNoun } from "@/lib/eventos-format";
import type { TipoEntidade } from "@/lib/eventos-format";

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface NotificationDialogProps {
  notification: Notification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationDialog({
  notification,
  open,
  onOpenChange,
}: NotificationDialogProps) {
  if (!notification) return null;

  const noun = capitalize(
    formatEntidadeNoun(notification.tipo_entidade as TipoEntidade),
  );
  const fullDate = format(
    new Date(notification.ocorrido_em),
    "d 'de' MMMM 'de' yyyy 'às' HH:mm",
    { locale: ptBR },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>{noun}</DialogTitle>
          <DialogDescription>
            {capitalize(notification.evento)} · {fullDate}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Fechar</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/notifications/notification-dialog.tsx
git commit -m "feat(ui): NotificationDialog — detail view for a notification event"
```

---

## Task 9: Rewrite `AppNotificationBell`

Replace the entire file. Bell becomes a Base UI Popover trigger. The `useNotifications` hook drives all state.

**Files:**
- Rewrite: `components/layout/app-notification-bell.tsx`

- [ ] **Step 1: Replace the file content**

```tsx
// components/layout/app-notification-bell.tsx
"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { BellIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/use-notifications";
import type { Notification } from "@/hooks/use-notifications";
import { NotificationItem } from "@/components/notifications/notification-item";
import { NotificationDialog } from "@/components/notifications/notification-dialog";

export function AppNotificationBell() {
  const { items, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [selected, setSelected] = React.useState<Notification | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  function handleItemOpen(notification: Notification) {
    markAsRead(notification.id);
    setSelected(notification);
    setDialogOpen(true);
  }

  return (
    <>
      <Popover.Root>
        <Popover.Trigger
          aria-label="Notificações"
          className={cn(
            "relative inline-flex size-9 items-center justify-center rounded-md text-[var(--color-fg-muted)]",
            "hover:bg-muted hover:text-foreground",
          )}
        >
          <BellIcon className="size-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-2 top-2 size-2 rounded-full bg-[var(--brand-accent-500)] ring-2 ring-background"
            />
          )}
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Positioner side="bottom" align="end" sideOffset={8}>
            <Popover.Popup
              className={cn(
                "z-50 w-80 rounded-md border border-[var(--color-border)] bg-white shadow-md",
                "outline-none",
                "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
                "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
                <span className="text-sm font-medium">Notificações</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-xs text-[var(--color-fg-muted)] hover:text-foreground transition-colors"
                  >
                    Marcar tudo lido
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-[360px] overflow-y-auto">
                {items.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-[var(--color-fg-muted)]">
                    Nenhuma notificação recente
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--color-border)]">
                    {items.map((n) => (
                      <NotificationItem
                        key={n.id}
                        notification={n}
                        onOpen={handleItemOpen}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      <NotificationDialog
        notification={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify manually**

```bash
npm run dev
```

Open the app in the browser. Check:
- [ ] Bell renders in the top nav without errors
- [ ] Clicking bell opens a popover below the bell, aligned to the right
- [ ] Popover shows list of recent events (or empty state if none)
- [ ] Unread items have an accent dot on the left
- [ ] "Marcar tudo lido" button appears when there are unread items
- [ ] Clicking an item opens the detail dialog and removes its unread dot
- [ ] "Marcar tudo lido" clears all dots
- [ ] Creating a new `afastamento` or `ocorrencia` event in another tab causes a new item to appear instantly without a page refresh (realtime working)

- [ ] **Step 4: Commit**

```bash
git add components/layout/app-notification-bell.tsx
git commit -m "feat(ui): AppNotificationBell — popover + realtime, replaces 30s polling"
```
