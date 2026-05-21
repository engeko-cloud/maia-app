"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { fmtDateTime } from "@/lib/fmt-date";

export type FluigSheetData = {
  variant: "enviado" | "erro";
  afastamento_id: string;
  afastamento_serial_id: number | null;
  colaborador_nome: string;
  tipo: string;
  ocorrido_em: string | null;
  autor_nome?: string | null;
  retry?: boolean;
  tentativas?: number;
  /** Indicates the failure was later resolved by a successful resend. */
  resolved_at?: string | null;
  erro?: { message: string | null; status: number | null; raw: unknown } | null;
  response?: unknown;
};

interface Props {
  data: FluigSheetData;
  /** Trigger element (typically a row or button). */
  children: React.ReactElement;
  onRetried?: () => void;
}

export function FluigEventSheet({ data, children, onRetried }: Props) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const canRetry = data.variant === "erro" && !data.resolved_at;

  async function retry() {
    setBusy(true);
    try {
      const res = await fetch(`/api/afastamentos/${data.afastamento_id}/fluig/retry`, { method: "POST" });
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

  const titleText =
    data.variant === "enviado"
      ? data.retry
        ? "Reenvio ao Fluig bem-sucedido"
        : "Envio ao Fluig bem-sucedido"
      : data.resolved_at
      ? "Falha no envio ao Fluig (resolvida)"
      : "Falha no envio ao Fluig";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={children} />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{titleText}</SheetTitle>
          <SheetDescription>
            {data.colaborador_nome} · {data.tipo}
            {data.afastamento_serial_id != null && (
              <span className="ml-2 font-mono">#{data.afastamento_serial_id}</span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
              {data.variant === "enviado" ? "Enviado em" : "Última tentativa"}
            </h3>
            <p className="text-sm">
              {data.ocorrido_em ? fmtDateTime(data.ocorrido_em) : "—"}
              {data.autor_nome && (
                <span className="ml-2 text-[var(--color-fg-muted)]">por {data.autor_nome}</span>
              )}
              {data.tentativas != null && data.tentativas > 1 && (
                <span className="ml-2 text-[var(--color-fg-muted)]">
                  ({data.tentativas} tentativas nas últimas 24h)
                </span>
              )}
            </p>
          </section>

          {data.variant === "erro" && (
            <>
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
                  Erro retornado
                  {data.erro?.status != null && (
                    <span className="ml-2 font-mono text-[var(--color-fg-muted)]">
                      HTTP {data.erro.status}
                    </span>
                  )}
                </h3>
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--color-border)] bg-muted/30 p-3 text-xs">
                  {data.erro?.message ?? "Sem detalhes adicionais."}
                </pre>
              </section>

              {data.erro?.raw != null && (
                <details className="rounded-md border border-[var(--color-border)] bg-muted/20 px-3 py-2 text-xs">
                  <summary className="cursor-pointer text-[var(--color-fg-muted)]">
                    Ver resposta bruta da edge function
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono">
                    {JSON.stringify(data.erro.raw, null, 2)}
                  </pre>
                </details>
              )}

              {data.resolved_at && (
                <section className="rounded-md border border-[var(--color-success-soft)] bg-[var(--color-success-soft)]/40 px-3 py-2 text-xs">
                  <p className="font-medium text-[var(--color-success)]">
                    Reenviado com sucesso em {fmtDateTime(data.resolved_at)}.
                  </p>
                </section>
              )}
            </>
          )}

          {data.variant === "enviado" && data.response != null && (
            <details className="rounded-md border border-[var(--color-border)] bg-muted/20 px-3 py-2 text-xs">
              <summary className="cursor-pointer text-[var(--color-fg-muted)]">
                Ver resposta do Fluig
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono">
                {typeof data.response === "string"
                  ? data.response
                  : JSON.stringify(data.response, null, 2)}
              </pre>
            </details>
          )}
        </div>

        <SheetFooter>
          {canRetry && (
            <Button type="button" disabled={busy} onClick={() => void retry()}>
              {busy ? "Reenviando…" : "Retentar agora"}
            </Button>
          )}
          <Link href={`/app/afastamentos/${data.afastamento_id}`} className="w-full">
            <Button type="button" variant="secondary" className="w-full">
              Abrir afastamento
            </Button>
          </Link>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
