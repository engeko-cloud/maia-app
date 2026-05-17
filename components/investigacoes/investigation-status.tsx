import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InvestigacaoSummary } from "./investigacao-summary";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

interface Props {
  ocorrenciaId: string;
  investigacao: {
    situacao: "em_andamento" | "em_aprovacao" | "aprovada" | "rejeitada" | "cancelada";
    dados: InvestigacaoDados | null;
    token_publico?: string | null;
    motivo_rejeicao?: string | null;
  } | null;
}

const EMPTY_DADOS: InvestigacaoDados = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] };

export function InvestigationStatus({ ocorrenciaId, investigacao }: Props) {
  const dados = (investigacao?.dados ?? EMPTY_DADOS);
  const isEmpty =
    dados.ishikawa.length + dados.plano_acao.length + dados.participantes.length + dados.fotos.length === 0;
  const situacao = investigacao?.situacao;

  if (situacao === "aprovada") {
    return (
      <section className="flex flex-col gap-3">
        <InvestigacaoSummary ocorrenciaId={ocorrenciaId} dados={dados} />
        {investigacao?.token_publico ? (
          <Link href={`/ocorrencias/relatorio/${investigacao.token_publico}`} target="_blank" className="self-start">
            <Button variant="secondary">Ver relatório</Button>
          </Link>
        ) : null}
      </section>
    );
  }

  if (situacao === "em_aprovacao") {
    return (
      <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
        <header className="mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
            Investigação
          </h2>
        </header>
        <p className="mb-4 text-sm text-[var(--color-fg-muted)]">Aguardando aprovação da equipe de segurança.</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/ocorrencias/${ocorrenciaId}/investigacao`}>
            <Button>Revisar agora</Button>
          </Link>
          {investigacao?.token_publico ? (
            <Link href={`/ocorrencias/relatorio/${investigacao.token_publico}`} target="_blank">
              <Button variant="secondary">Ver relatório</Button>
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  if (situacao === "rejeitada") {
    const motivoPreview = (investigacao?.motivo_rejeicao ?? "").trim();
    const truncated = motivoPreview.length > 160 ? `${motivoPreview.slice(0, 160)}…` : motivoPreview;
    return (
      <section className="rounded-md border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-6">
        <header className="mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-danger)]">
            Investigação rejeitada
          </h2>
        </header>
        {truncated ? (
          <p className="mb-4 whitespace-pre-wrap text-sm text-[var(--color-fg)]">{truncated}</p>
        ) : null}
        <Link href={`/ocorrencias/${ocorrenciaId}/investigacao`}>
          <Button>Ajustar investigação</Button>
        </Link>
      </section>
    );
  }

  if (situacao === "cancelada") {
    return (
      <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
        <header className="mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
            Investigação
          </h2>
        </header>
        <p className="text-sm text-[var(--color-fg-muted)]">Esta investigação foi cancelada.</p>
      </section>
    );
  }

  // em_andamento (default)
  return (
    <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
      <header className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Investigação
        </h2>
      </header>
      <p className="mb-4 text-sm text-[var(--color-fg-muted)]">
        {isEmpty
          ? "Ainda não iniciada. Abra a investigação para registrar Ishikawa, ações, participantes e fotos."
          : "Investigação em andamento. Continue de onde parou."}
      </p>
      <Link href={`/ocorrencias/${ocorrenciaId}/investigacao`}>
        <Button>{isEmpty ? "Iniciar investigação" : "Continuar investigação"}</Button>
      </Link>
    </section>
  );
}
