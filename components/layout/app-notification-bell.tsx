"use client";

import { BellIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppNotificationBellProps {
  unread?: boolean;
}

export function AppNotificationBell({ unread = false }: AppNotificationBellProps) {
  return (
    <button
      type="button"
      aria-label="Notificações"
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-md text-[var(--color-fg-muted)]",
        "hover:bg-muted hover:text-foreground",
      )}
    >
      <BellIcon className="size-5" aria-hidden="true" />
      {unread && (
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 size-2 rounded-full bg-[var(--brand-accent-500)] ring-2 ring-background"
        />
      )}
    </button>
  );
}
