import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  eventoDotTone,
  formatEntidadeNoun,
  formatEventoVerb,
  type TipoEntidade,
} from "@/lib/eventos-format";
import type { EventoType } from "@/lib/eventos";

export interface ActivityFeedRow {
  id: string;
  tipo_entidade: TipoEntidade;
  entidade_id: string;
  evento: EventoType;
  ocorrido_em: string;
  autor_nome: string | null;
}

const dotColor: Record<ReturnType<typeof eventoDotTone>, string> = {
  new:       "bg-[var(--color-info)]",
  approved:  "bg-[var(--color-success)]",
  rejected:  "bg-[var(--color-danger)]",
  muted:     "bg-[var(--color-fg-subtle)]",
};

function detailHref(row: ActivityFeedRow): string {
  if (row.tipo_entidade === "afastamento") return `/app/afastamentos/${row.entidade_id}`;
  if (row.tipo_entidade === "ocorrencia") return `/app/ocorrencias/${row.entidade_id}`;
  return `/app/ocorrencias/${row.entidade_id}/investigacao`;
}

interface ActivityFeedProps {
  rows: ActivityFeedRow[];
  seeAllHref?: string;
}

export function ActivityFeed({ rows, seeAllHref }: ActivityFeedProps) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-xs)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="text-sm font-semibold">Atividade recente</h2>
        {seeAllHref && (
          <Link href={seeAllHref} className="text-xs text-[var(--color-fg-muted)] hover:text-foreground">
            Ver tudo →
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[var(--color-fg-muted)]">Sem atividade recente.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {rows.map((row) => {
            const tone = eventoDotTone(row.evento);
            const autor = row.autor_nome?.trim() || "Sistema";
            const verbo = formatEventoVerb(row.evento);
            const noun = formatEntidadeNoun(row.tipo_entidade);
            const when = formatDistanceToNow(new Date(row.ocorrido_em), {
              addSuffix: true,
              locale: ptBR,
            });
            return (
              <li key={row.id}>
                <Link
                  href={detailHref(row)}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50"
                >
                  <span
                    aria-hidden="true"
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", dotColor[tone])}
                  />
                  <span className="flex-1 text-sm">
                    <span className="font-medium text-foreground">{autor}</span>{" "}
                    <span className="text-[var(--color-fg-muted)]">{verbo} {noun}</span>
                  </span>
                  <span className="font-mono text-xs text-[var(--color-fg-subtle)]">{when}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
