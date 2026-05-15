"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";
import type { SaudeMetrics } from "@/lib/dashboard/queries";

function useInterval(callback: () => void, delay: number) {
  const saved = React.useRef(callback);
  React.useEffect(() => { saved.current = callback; }, [callback]);
  React.useEffect(() => {
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

export function SaudeBanner() {
  const [failures, setFailures] = React.useState(0);

  async function check() {
    try {
      const r = await fetch("/api/saude");
      if (!r.ok) return;
      const data: SaudeMetrics = await r.json();
      setFailures(data.emails_falhados.count + data.fluig_falhados.count);
    } catch {
      // silent — don't show banner on polling error
    }
  }

  React.useEffect(() => { check(); }, []);
  useInterval(check, 30_000);

  if (failures === 0) return null;

  return (
    <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
      <span className="flex items-center gap-2">
        <AlertTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
        {failures} {failures === 1 ? "falha" : "falhas"} nas últimas 24 h
      </span>
      <Link href="/painel/saude" className="font-medium underline hover:text-red-900">
        ver painel →
      </Link>
    </div>
  );
}
