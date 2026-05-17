import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DetailHeader } from "@/components/detail/detail-header";
import { StatusPill } from "@/components/data/status-pill";
import { TimelineEvents, type TimelineEventRow } from "@/components/detail/timeline-events";
import { OcorrenciaDetailCard, type OcorrenciaFull } from "@/components/ocorrencias/ocorrencia-detail-card";
import { InvestigationStatus } from "@/components/investigacoes/investigation-status";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

type OcorrenciaWithInvestigacoes = OcorrenciaFull & {
  investigacoes: {
    id: string;
    situacao: "em_andamento" | "em_aprovacao" | "aprovada" | "rejeitada" | "cancelada";
    dados: InvestigacaoDados | null;
    token_publico: string;
    motivo_rejeicao: string | null;
  }[] | null;
};

export default async function OcorrenciaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  const [{ data: rawRow }, { data: timelineData }] = await Promise.all([
    supabase
      .from("ocorrencias")
      .select("*, empresas!inner(nome), unidades!inner(nome), investigacoes(id, situacao, dados, token_publico, motivo_rejeicao)")
      .eq("id", id)
      .single(),
    supabase
      .from("eventos")
      .select("id, evento, ocorrido_em, usuarios:autor_id(nome)")
      .eq("tipo_entidade", "ocorrencia")
      .eq("entidade_id", id)
      .order("ocorrido_em", { ascending: false })
      .returns<TimelineEventRow[]>(),
  ]);
  if (!rawRow) notFound();
  const row = rawRow as unknown as OcorrenciaWithInvestigacoes;

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        breadcrumbs={[
          { label: "Painel", href: "/painel" },
          { label: "Ocorrências", href: "/ocorrencias" },
          { label: ocorrenciaTipoLabel(row.tipo) },
        ]}
        title={ocorrenciaTipoLabel(row.tipo)}
        meta={
          <>
            <StatusPill domain="ocorrencia" situacao={row.situacao} />
            <span>{row.empresas?.nome ?? "—"}</span>
            <span className="font-mono">{new Date(row.data_ocorrencia).toLocaleString("pt-BR")}</span>
          </>
        }
      />

      <InvestigationStatus
        ocorrenciaId={row.id}
        investigacao={row.investigacoes?.[0] ?? null}
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <OcorrenciaDetailCard o={row} />
        <aside className="flex flex-col gap-6">
          <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
              Histórico
            </h2>
            <TimelineEvents rows={timelineData ?? []} tipoEntidade="ocorrencia" />
          </section>
        </aside>
      </div>
    </div>
  );
}
