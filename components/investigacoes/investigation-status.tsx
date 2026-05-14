import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InvestigacaoSummary } from "./investigacao-summary";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

interface Props {
  ocorrenciaId: string;
  investigacao: { situacao: "em_andamento" | "finalizada"; dados: InvestigacaoDados | null } | null;
}

const EMPTY_DADOS: InvestigacaoDados = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] };

export function InvestigationStatus({ ocorrenciaId, investigacao }: Props) {
  const dados = (investigacao?.dados ?? EMPTY_DADOS);
  const isEmpty =
    dados.ishikawa.length + dados.plano_acao.length + dados.participantes.length + dados.fotos.length === 0;

  if (investigacao?.situacao === "finalizada") {
    return <InvestigacaoSummary ocorrenciaId={ocorrenciaId} dados={dados} />;
  }

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
