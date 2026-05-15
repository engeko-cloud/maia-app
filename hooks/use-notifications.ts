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
