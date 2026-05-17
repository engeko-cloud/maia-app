"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";

type Props = { cpf: string };

export function ExportHistoryButton({ cpf }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleClick() {
    setState("loading");
    try {
      const res = await fetch("/api/relatorios/afastamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <span className="text-sm text-[var(--color-fg-muted)]">
        Relatório enviado para o seu e-mail.
      </span>
    );
  }

  if (state === "error") {
    return (
      <span className="text-sm text-red-600">Erro ao gerar relatório.</span>
    );
  }

  return (
    <button
      type="button"
      disabled={state === "loading"}
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-fg-muted)] hover:text-foreground hover:border-[var(--color-fg-muted)] transition-colors disabled:opacity-50"
    >
      <DownloadIcon className="size-4" aria-hidden="true" />
      {state === "loading" ? "Gerando…" : "Exportar histórico"}
    </button>
  );
}
