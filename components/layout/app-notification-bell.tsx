"use client";

import { BellIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppNotificationBell() {
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
    </button>
  );
}
