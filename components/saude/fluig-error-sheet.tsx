"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { fmtDateTime } from "@/lib/fmt-date";
import type { FailedItem } from "@/lib/dashboard/queries";

interface Props {
  item:       FailedItem;
  onRetried?: () => void;
}

export function FluigErrorSheet({ item, onRetried }: Props) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function retry() {
    setBusy(true);
    try {
      const res = await fetch(`/api/afastamentos/${item.id}/fluig/retry`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) {
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast.success("Reenviado ao Fluig com sucesso.");
      setOpen(false);
      onRetried?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha ao reenviar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            className="ml-2 shrink-0 text-red-600 underline hover:text-red-800"
          >
            ver →
          </button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Falha no envio ao Fluig</SheetTitle>
          <SheetDescription>
            {item.colaborador_nome} · {item.tipo}
            {item.serial_id != null && <span className="ml-2 font-mono">#{item.serial_id}</span>}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
              Última tentativa
            </h3>
            <p className="text-sm">
              {item.ocorrido_em ? fmtDateTime(item.ocorrido_em) : "—"}
              {item.tentativas != null && item.tentativas > 1 && (
                <span className="ml-2 text-[var(--color-fg-muted)]">
                  ({item.tentativas} tentativas nas últimas 24h)
                </span>
              )}
            </p>
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
              Erro retornado
              {item.ultimo_erro_status != null && (
                <span className="ml-2 font-mono text-[var(--color-fg-muted)]">
                  HTTP {item.ultimo_erro_status}
                </span>
              )}
            </h3>
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--color-border)] bg-muted/30 p-3 text-xs">
              {item.ultimo_erro ?? "Sem detalhes adicionais."}
            </pre>
          </section>

          {item.ultimo_erro_raw != null && (
            <details className="rounded-md border border-[var(--color-border)] bg-muted/20 px-3 py-2 text-xs">
              <summary className="cursor-pointer text-[var(--color-fg-muted)]">
                Ver resposta bruta da edge function
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono">
                {JSON.stringify(item.ultimo_erro_raw, null, 2)}
              </pre>
            </details>
          )}
        </div>

        <SheetFooter>
          <Button type="button" disabled={busy} onClick={() => void retry()}>
            {busy ? "Reenviando…" : "Retentar agora"}
          </Button>
          <Link href={`/app/afastamentos/${item.id}`} className="w-full">
            <Button type="button" variant="secondary" className="w-full">
              Abrir afastamento
            </Button>
          </Link>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
