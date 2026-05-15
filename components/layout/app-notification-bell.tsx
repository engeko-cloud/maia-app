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
              <div className="max-h-[400px] overflow-y-auto">
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
