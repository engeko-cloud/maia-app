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
