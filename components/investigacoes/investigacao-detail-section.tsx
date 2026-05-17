import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/data/status-pill";
import { InvestigacaoDataView } from "./investigacao-data-view";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

interface Categoria { rotulo: string; codigo: string; }
interface Grau { rotulo: string; }

interface InvestigacaoDetailSectionProps {
  ocorrenciaId: string;
  investigacao: {
    situacao: "em_andamento" | "em_aprovacao" | "aprovada" | "rejeitada" | "cancelada";
    dados: InvestigacaoDados;
    token_publico: string;
    motivo_rejeicao: string | null;
  };
  categoriasById: Record<string, Categoria>;
  grausById: Record<string, Grau>;
  storagePublicBase: string;
}

export function InvestigacaoDetailSection({
  ocorrenciaId, investigacao, categoriasById, grausById, storagePublicBase,
}: InvestigacaoDetailSectionProps) {
  const editHref = `/app/ocorrencias/${ocorrenciaId}/investigacao`;
  const reportHref = `/ocorrencias/relatorio/${investigacao.token_publico}`;
  const { situacao } = investigacao;

  return (
    <section className="flex flex-col gap-6 rounded-md border border-[var(--color-border)] bg-white p-6">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Investigação
        </h2>
        <StatusPill domain="investigacao" situacao={situacao} />
      </header>

      <InvestigacaoDataView
        dados={investigacao.dados}
        categoriasById={categoriasById}
        grausById={grausById}
        storagePublicBase={storagePublicBase}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-4">
        {situacao === "em_andamento" && (
          <Link href={editHref}>
            <Button>Abrir investigação</Button>
          </Link>
        )}
        {situacao === "em_aprovacao" && (
          <>
            <p className="mr-2 text-sm text-[var(--color-fg-muted)]">Aguardando aprovação.</p>
            <Link href={editHref}><Button>Revisar agora</Button></Link>
            <Link href={reportHref} target="_blank">
              <Button variant="secondary">Ver relatório</Button>
            </Link>
          </>
        )}
        {situacao === "rejeitada" && (
          <div className="flex w-full flex-col gap-3">
            {investigacao.motivo_rejeicao ? (
              <div className="rounded-md border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-3 text-sm">
                <p className="mb-1 font-medium text-[var(--color-danger)]">Motivo da rejeição</p>
                <p className="whitespace-pre-wrap text-[var(--color-fg)]">{investigacao.motivo_rejeicao}</p>
              </div>
            ) : null}
            <Link href={editHref} className="self-start">
              <Button>Ajustar investigação</Button>
            </Link>
          </div>
        )}
        {situacao === "aprovada" && (
          <Link href={reportHref} target="_blank">
            <Button variant="secondary">Ver relatório</Button>
          </Link>
        )}
        {situacao === "cancelada" && (
          <p className="text-sm text-[var(--color-fg-muted)]">Investigação cancelada.</p>
        )}
      </div>
    </section>
  );
}
