import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  eventoDotTone,
  formatEventoVerb,
  type EventoTone,
  type TipoEntidade,
} from "@/lib/eventos-format";
import type { EventoType } from "@/lib/eventos";
import { EmptyState } from "@/components/data/empty-state";
import { ClockIcon } from "lucide-react";

export interface TimelineEventRow {
  id: string;
  evento: EventoType;
  ocorrido_em: string;
  /** Joined: usuarios:autor_id(nome) */
  usuarios?: { nome: string | null } | null;
}

interface TimelineEventsProps {
  rows: TimelineEventRow[];
  /** Used by the verb formatter to phrase the entry. Not currently shown but kept for parity. */
  tipoEntidade: TipoEntidade;
}

const DOT_CLASS: Record<EventoTone, string> = {
  new:      "bg-[var(--color-info)]",
  approved: "bg-[var(--color-success)]",
  rejected: "bg-[var(--color-danger)]",
  muted:    "bg-[var(--color-fg-subtle)]",
};

export function TimelineEvents({ rows }: TimelineEventsProps) {
  if (rows.length === 0) {
    return <EmptyState icon={ClockIcon} title="Sem eventos ainda." />;
  }
  return (
    <ol className="space-y-3" aria-label="Histórico">
      {rows.map((row) => {
        const tone = eventoDotTone(row.evento);
        const verb = formatEventoVerb(row.evento);
        const autor = row.usuarios?.nome?.trim() || "Sistema";
        const when = formatDistanceToNow(new Date(row.ocorrido_em), { addSuffix: true, locale: ptBR });
        return (
          <li key={row.id} className="flex gap-3">
            <span className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={cn("size-2 rounded-full", DOT_CLASS[tone])}
              />
              <span aria-hidden="true" className="mt-1 h-full w-px bg-[var(--color-border)]" />
            </span>
            <div className="flex flex-col pb-3 leading-tight">
              <p className="text-sm text-foreground">
                <span className="font-semibold">{autor}</span> {verb}.
              </p>
              <time
                dateTime={row.ocorrido_em}
                className="text-xs text-[var(--color-fg-muted)]"
                title={new Date(row.ocorrido_em).toLocaleString("pt-BR")}
              >
                {when}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
