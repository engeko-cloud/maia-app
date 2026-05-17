import { FieldGrid } from "@/components/detail/field-grid";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

interface Props {
  ocorrenciaId: string;
  dados: InvestigacaoDados;
}

export function InvestigacaoSummary({ ocorrenciaId, dados }: Props) {
  const causasCount  = dados.ishikawa.reduce((acc, b) => acc + b.causas.length, 0);
  const acoesAbertas = dados.plano_acao.filter((a) => a.status === "pendente" || a.status === "em_andamento").length;
  const acoesConcl   = dados.plano_acao.filter((a) => a.status === "concluida").length;

  return (
    <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Investigação finalizada
        </h2>
        <Link href={`/app/ocorrencias/${ocorrenciaId}/investigacao`}>
          <Button variant="secondary" size="sm">Ver investigação</Button>
        </Link>
      </header>
      <FieldGrid
        fields={[
          { label: "Causas registradas",  value: String(causasCount) },
          { label: "Ações pendentes",     value: String(acoesAbertas) },
          { label: "Ações concluídas",    value: String(acoesConcl) },
          { label: "Participantes",       value: String(dados.participantes.length) },
          { label: "Fotos",               value: String(dados.fotos.length) },
        ]}
      />
    </section>
  );
}
