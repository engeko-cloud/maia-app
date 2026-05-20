"use client";

import * as React from "react";
import Link from "next/link";
import { MetricCard, type MetricTone } from "@/components/saude/metric-card";
import { FluigErrorSheet } from "@/components/saude/fluig-error-sheet";
import type { SaudeMetrics, FailedItem } from "@/lib/dashboard/queries";

function useInterval(callback: () => void, delay: number) {
  const saved = React.useRef(callback);
  React.useEffect(() => { saved.current = callback; }, [callback]);
  React.useEffect(() => {
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

function formatHoras(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1)} h`;
}

interface FailedListProps {
  items: FailedItem[];
  total: number;
  /** When set, "ver" opens the FluigErrorSheet with details + retry. */
  variant?: "default" | "fluig";
  onRetried?: () => void;
}

function FailedList({ items, total, variant = "default", onRetried }: FailedListProps) {
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between text-xs">
          <span className="truncate text-[var(--color-fg-muted)]">
            {item.colaborador_nome} · {item.tipo}
          </span>
          {variant === "fluig" ? (
            <FluigErrorSheet item={item} onRetried={onRetried} />
          ) : (
            <Link
              href={`/app/afastamentos/${item.id}`}
              className="ml-2 shrink-0 text-red-600 underline hover:text-red-800"
            >
              ver →
            </Link>
          )}
        </li>
      ))}
      {total > items.length && (
        <li className="text-xs text-[var(--color-fg-muted)]">
          + {total - items.length} outros
        </li>
      )}
    </ul>
  );
}

function latenciaTone(p50: number | null, threshold: number): MetricTone {
  if (p50 === null) return "neutral";
  return p50 > threshold ? "error" : "ok";
}

interface SaudeClientProps {
  initial: SaudeMetrics;
}

export function SaudeClient({ initial }: SaudeClientProps) {
  const [data, setData] = React.useState<SaudeMetrics>(initial);
  const [lastUpdated, setLastUpdated] = React.useState<Date>(new Date());
  const [stale, setStale] = React.useState(false);

  async function refresh() {
    try {
      const r = await fetch("/api/saude");
      if (!r.ok) { setStale(true); return; }
      setData(await r.json());
      setLastUpdated(new Date());
      setStale(false);
    } catch {
      setStale(true);
    }
  }

  useInterval(refresh, 30_000);

  const updatedLabel = `última atualização: ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}${stale ? " (dados podem estar desatualizados)" : ""}`;

  const totalAfastos = data.afastos_por_tipo.reduce((s, t) => s + t.count, 0);

  return (
    <div className="space-y-8">
      {/* Alertas */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Alertas — última 24 h
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetricCard
            label="Emails falhados"
            value={data.emails_falhados.count}
            tone={data.emails_falhados.count > 0 ? "error" : "ok"}
            delta={data.emails_falhados.count === 0 ? "Tudo enviado" : undefined}
          >
            {data.emails_falhados.count > 0 && (
              <FailedList items={data.emails_falhados.items} total={data.emails_falhados.count} />
            )}
          </MetricCard>
          <MetricCard
            label="Pushes Fluig falhados"
            value={data.fluig_falhados.count}
            tone={data.fluig_falhados.count > 0 ? "error" : "ok"}
            delta={data.fluig_falhados.count === 0 ? "Tudo enviado" : undefined}
          >
            {data.fluig_falhados.count > 0 && (
              <FailedList
                items={data.fluig_falhados.items}
                total={data.fluig_falhados.count}
                variant="fluig"
                onRetried={refresh}
              />
            )}
          </MetricCard>
        </div>
      </section>

      {/* Operacional */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Operacional — mês corrente
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Aprovação P50"
            value={formatHoras(data.aprovacao_p50_horas)}
            tone={latenciaTone(data.aprovacao_p50_horas, data.threshold_horas)}
            delta={`limiar: ${data.threshold_horas}h`}
          />
          <MetricCard
            label="Aprovação P95"
            value={formatHoras(data.aprovacao_p95_horas)}
            tone="neutral"
          />
          {data.ocorrencias_por_situacao.map((o) => (
            <MetricCard
              key={o.situacao}
              label={`Ocorrências ${o.situacao}`}
              value={o.count}
              tone="neutral"
            />
          ))}
          <MetricCard
            label="Anexos presentes"
            value={data.anexos_presentes}
            tone="neutral"
            delta={`${data.anexos_ausentes} sem anexo`}
          />
        </div>

        {/* Distribuição por tipo */}
        <div className="mt-4 rounded-md border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-xs)]">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
            Afastamentos por tipo — {totalAfastos} no mês
          </p>
          <div className="space-y-2">
            {data.afastos_por_tipo.map((t) => (
              <div key={t.rotulo}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="truncate text-foreground">{t.rotulo}</span>
                  <span className="ml-2 shrink-0 font-semibold text-foreground">{t.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-sm bg-[var(--color-border)]">
                  <div
                    className="h-full rounded-sm bg-[var(--brand-accent-500)]"
                    style={{ width: `${t.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <p className="text-xs text-[var(--color-fg-subtle)]">{updatedLabel}</p>
    </div>
  );
}
