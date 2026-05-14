import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DetailHeader } from "@/components/detail/detail-header";
import { StatusPill } from "@/components/data/status-pill";
import { TimelineEvents, type TimelineEventRow } from "@/components/detail/timeline-events";
import { InvestigacaoForm } from "@/components/ocorrencias/investigacao-form";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";

interface OcorrenciaSummary {
  id: string;
  tipo: string;
  situacao: string;
  data_ocorrencia: string;
  investigacoes: { id: string; situacao: string; dados: Record<string, unknown> | null }[] | null;
}

export default async function InvestigacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  const [{ data: rawRow }, { data: timelineData }] = await Promise.all([
    supabase
      .from("ocorrencias")
      .select("id, tipo, situacao, data_ocorrencia, investigacoes(id, situacao, dados)")
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
  const row = rawRow as unknown as OcorrenciaSummary;

  const initialDados = (row.investigacoes?.[0]?.dados ?? {}) as {
    contexto?: string; causas?: string; acoes?: string; conclusao?: string;
  };

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        breadcrumbs={[
          { label: "Painel", href: "/painel" },
          { label: "Ocorrências", href: "/ocorrencias" },
          { label: ocorrenciaTipoLabel(row.tipo), href: `/ocorrencias/${row.id}` },
          { label: "Investigação" },
        ]}
        title="Investigação"
        meta={
          <>
            <StatusPill domain="ocorrencia" situacao={row.situacao} />
            <span>{ocorrenciaTipoLabel(row.tipo)}</span>
            <span className="font-mono">{new Date(row.data_ocorrencia).toLocaleString("pt-BR")}</span>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <InvestigacaoForm ocorrenciaId={row.id} initialDados={initialDados} />
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
