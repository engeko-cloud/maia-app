"use client";

import * as React from "react";
import { BellIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function useInterval(callback: () => void, delay: number) {
  const saved = React.useRef(callback);
  React.useEffect(() => { saved.current = callback; }, [callback]);
  React.useEffect(() => {
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

export function AppNotificationBell() {
  const [count, setCount] = React.useState(0);

  async function fetchCount() {
    try {
      const r = await fetch("/api/notificacoes/unread");
      if (!r.ok) return;
      const data: { count: number } = await r.json();
      setCount(data.count);
    } catch {
      // silent
    }
  }

  React.useEffect(() => { fetchCount(); }, []);
  useInterval(fetchCount, 30_000);

  function handleClick() {
    setCount(0); // client-side dismiss
  }

  return (
    <button
      type="button"
      aria-label="Notificações"
      onClick={handleClick}
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-md text-[var(--color-fg-muted)]",
        "hover:bg-muted hover:text-foreground",
      )}
    >
      <BellIcon className="size-5" aria-hidden="true" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 size-2 rounded-full bg-[var(--brand-accent-500)] ring-2 ring-background"
        />
      )}
    </button>
  );
}
