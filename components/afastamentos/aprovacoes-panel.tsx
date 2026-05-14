import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRightIcon, FileTextIcon } from "lucide-react";
import { ApprovalBar } from "@/components/detail/approval-bar";
import { EmptyState } from "@/components/data/empty-state";
import { cn } from "@/lib/utils";

export interface PendenteRow {
  id: string;
  colaborador_nome: string;
  cpf: string;
  data_inicio: string;
  data_fim: string | null;
  criado_em: string;
  email_remetente: string;
  arquivo_url: string | null;
  afastamento_tipos: { rotulo: string } | null;
}

interface AprovacoesPanelProps {
  pendentes: PendenteRow[];
}

export function AprovacoesPanel({ pendentes }: AprovacoesPanelProps) {
  if (pendentes.length === 0) {
    return (
      <EmptyState
        icon={FileTextIcon}
        title="Sem pendências."
        hint="Quando colaboradores enviarem afastamentos, eles aparecerão aqui."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {pendentes.map((p) => {
        const isUrgent = false;
        const since = formatDistanceToNow(new Date(p.criado_em), { addSuffix: true, locale: ptBR });
        return (
          <li
            key={p.id}
            className={cn(
              "relative rounded-md border border-[var(--color-border)] bg-white shadow-[var(--shadow-xs)]",
              isUrgent && "border-l-[3px] border-l-[var(--brand-accent-500)]",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] p-4">
              <div className="flex flex-col">
                <p className="text-base font-semibold text-foreground">{p.colaborador_nome}</p>
                <p className="font-mono text-xs text-[var(--color-fg-muted)]">{p.cpf}</p>
                <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                  {p.afastamento_tipos?.rotulo ?? "—"} · {p.data_inicio}
                  {p.data_fim ? ` → ${p.data_fim}` : ""}
                </p>
              </div>
              <div className="text-right text-xs text-[var(--color-fg-muted)]">
                <p>Enviado {since}</p>
                <p>{p.email_remetente}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <Link
                href={`/afastamentos/${p.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-primary-600)] hover:underline"
              >
                Ver detalhes
                <ArrowRightIcon className="size-3.5" aria-hidden="true" />
              </Link>
              <ApprovalBar afastamentoId={p.id} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
