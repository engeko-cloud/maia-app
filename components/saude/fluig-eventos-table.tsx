"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2Icon, AlertTriangleIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/fmt-date";
import { FluigEventSheet } from "@/components/saude/fluig-event-sheet";
import type { FluigEventRow, FluigEventosFilters, FluigEventosPage } from "@/lib/dashboard/fluig-eventos";

interface Props {
  initial: FluigEventosPage;
  initialFilters: FluigEventosFilters;
}

const STATUS_CHIPS: Array<{ value: FluigEventosFilters["status"]; label: string; tone?: "ok" | "warn" | "neutral" }> = [
  { value: "all",     label: "Todos",                tone: "neutral" },
  { value: "pending", label: "Falhas pendentes",     tone: "warn" },
  { value: "erro",    label: "Falhas (incl. resolvidas)" },
  { value: "enviado", label: "Sucessos",             tone: "ok" },
];

function buildHref(
  current: { status: string; q: string; from: string; to: string; page: number },
  patch: Partial<{ status: string; q: string; from: string; to: string; page: number }>,
): string {
  const merged = { ...current, ...patch };
  const usp = new URLSearchParams();
  if (merged.status && merged.status !== "all") usp.set("status", merged.status);
  if (merged.q) usp.set("q", merged.q);
  if (merged.from) usp.set("from", merged.from);
  if (merged.to) usp.set("to", merged.to);
  if (merged.page && merged.page > 1) usp.set("page", String(merged.page));
  const qs = usp.toString();
  return qs ? `/app/painel/saude/fluig?${qs}` : `/app/painel/saude/fluig`;
}

export function FluigEventosTable({ initial, initialFilters }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const [draftQ, setDraftQ] = React.useState(initialFilters.q);

  const current = React.useMemo(
    () => ({
      status: sp.get("status") ?? "all",
      q: sp.get("q") ?? "",
      from: sp.get("from") ?? "",
      to: sp.get("to") ?? "",
      page: Math.max(1, Number(sp.get("page") ?? "1")),
    }),
    [sp],
  );

  React.useEffect(() => {
    setDraftQ(current.q);
  }, [current.q]);

  function commit(patch: Partial<{ status: string; q: string; from: string; to: string; page: number }>) {
    startTransition(() => {
      router.push(buildHref(current, { ...patch, page: patch.page ?? 1 }));
    });
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    commit({ q: draftQ });
  }

  const refresh = React.useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  const data = initial;
  const loading = isPending;
  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));
  const rangeStart = data.items.length === 0 ? 0 : (current.page - 1) * data.page_size + 1;
  const rangeEnd = rangeStart + data.items.length - 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <form onSubmit={onSearchSubmit} className="relative w-full max-w-sm">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-fg-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            placeholder="Buscar por nome ou #identificador…"
            className="w-full rounded-md border border-[var(--color-border)] bg-white py-1.5 pl-9 pr-3 text-sm placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--brand-primary-600)] focus:outline-none"
          />
        </form>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)]">
            de
            <input
              type="date"
              value={current.from}
              onChange={(e) => commit({ from: e.target.value })}
              className="rounded-md border border-[var(--color-border)] bg-white px-2 py-1 text-xs"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)]">
            até
            <input
              type="date"
              value={current.to}
              onChange={(e) => commit({ to: e.target.value })}
              className="rounded-md border border-[var(--color-border)] bg-white px-2 py-1 text-xs"
            />
          </label>
        </div>
      </div>

      <div role="tablist" aria-label="Filtro de status" className="flex flex-wrap items-center gap-1.5">
        {STATUS_CHIPS.map((chip) => {
          const active = current.status === chip.value || (chip.value === "all" && !current.status);
          return (
            <button
              key={chip.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => commit({ status: chip.value })}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? chip.tone === "warn"
                    ? "bg-[var(--color-accent-soft)] text-[var(--brand-accent-600)]"
                    : chip.tone === "ok"
                    ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                    : "bg-[var(--brand-primary-50)] text-[var(--brand-primary-600)]"
                  : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-foreground",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {data.items.length === 0 ? (
        <div className="rounded-md border border-[var(--color-border)] bg-white p-10 text-center text-sm text-[var(--color-fg-muted)]">
          Nenhum evento encontrado para os filtros atuais.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-subtle)]">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
                <th className="px-3 py-2 w-44">Quando</th>
                <th className="px-3 py-2 w-32">Status</th>
                <th className="px-3 py-2">Afastamento</th>
                <th className="px-3 py-2 w-40">Autor</th>
                <th className="px-3 py-2">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <EventRow key={row.evento_id} row={row} onRetried={refresh} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-[var(--color-fg-muted)]">
        <span>
          {data.total === 0 ? "0 eventos" : `${rangeStart}–${rangeEnd} de ${data.total}`}
          {loading && " · atualizando…"}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={current.page <= 1}
            onClick={() => commit({ page: current.page - 1 })}
            className="rounded-md border border-[var(--color-border)] px-2 py-1 disabled:opacity-40"
          >
            ← anterior
          </button>
          <span className="font-mono">
            {current.page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={current.page >= totalPages}
            onClick={() => commit({ page: current.page + 1 })}
            className="rounded-md border border-[var(--color-border)] px-2 py-1 disabled:opacity-40"
          >
            próxima →
          </button>
        </div>
      </div>
    </div>
  );
}

function EventRow({ row, onRetried }: { row: FluigEventRow; onRetried?: () => void }) {
  return (
    <FluigEventSheet
      data={{
        variant: row.evento === "fluig_enviado" ? "enviado" : "erro",
        afastamento_id: row.afastamento_id,
        afastamento_serial_id: row.afastamento_serial_id,
        colaborador_nome: row.colaborador_nome,
        tipo: row.tipo,
        ocorrido_em: row.ocorrido_em,
        autor_nome: row.autor_nome,
        retry: row.retry,
        resolved_at: row.resolved_at,
        erro: row.erro,
        response: row.response,
      }}
      onRetried={onRetried}
    >
      <tr className="cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)]">
        <td className="px-3 py-2 font-mono text-[13px]">{fmtDateTime(row.ocorrido_em)}</td>
        <td className="px-3 py-2">
          <StatusBadge row={row} />
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-col">
            <span className="font-medium">{row.colaborador_nome}</span>
            <span className="text-xs text-[var(--color-fg-muted)]">
              {row.tipo}
              {row.afastamento_serial_id != null && (
                <span className="ml-2 font-mono">#{row.afastamento_serial_id}</span>
              )}
            </span>
          </div>
        </td>
        <td className="px-3 py-2 text-[var(--color-fg-muted)]">{row.autor_nome ?? "—"}</td>
        <td className="px-3 py-2 text-xs text-[var(--color-fg-muted)]">
          {row.evento === "fluig_erro"
            ? row.erro?.message ?? "Erro sem detalhes"
            : row.retry
            ? "Reenvio bem-sucedido"
            : "Envio inicial bem-sucedido"}
        </td>
      </tr>
    </FluigEventSheet>
  );
}

function StatusBadge({ row }: { row: FluigEventRow }) {
  if (row.evento === "fluig_enviado") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
        <CheckCircle2Icon className="size-3" aria-hidden="true" />
        {row.retry ? "reenvio ok" : "enviado"}
      </span>
    );
  }
  if (row.resolved_at) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-bg-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-fg-muted)]">
        <RefreshCwIcon className="size-3" aria-hidden="true" />
        falha resolvida
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-danger-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-danger)]">
      <AlertTriangleIcon className="size-3" aria-hidden="true" />
      falha
    </span>
  );
}
