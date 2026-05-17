import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DetailHeader } from "@/components/detail/detail-header";
import { StatusPill } from "@/components/data/status-pill";
import { TimelineEvents, type TimelineEventRow } from "@/components/detail/timeline-events";
import { InvestigacaoForm } from "@/components/investigacoes/investigacao-form";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

interface OcorrenciaSummary {
  id: string;
  tipo: string;
  situacao: string;
  data_ocorrencia: string;
  investigacoes: {
    id: string;
    situacao: "em_andamento" | "em_aprovacao" | "aprovada" | "rejeitada" | "cancelada";
    dados: InvestigacaoDados | null;
    token_publico: string;
  }[] | null;
}

const EMPTY_DADOS: InvestigacaoDados = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] };

export default async function InvestigacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const [
    { data: rawRow },
    { data: timelineData },
    { data: categorias },
    { data: graus },
    causasRes,
  ] = await Promise.all([
    supabase
      .from("ocorrencias")
      .select("id, tipo, situacao, data_ocorrencia, investigacoes(id, situacao, dados, token_publico)")
      .eq("id", id)
      .single(),
    supabase
      .from("eventos")
      .select("id, evento, ocorrido_em, usuarios:autor_id(nome)")
      .in("tipo_entidade", ["ocorrencia", "investigacao"])
      .eq("entidade_id", id)
      .order("ocorrido_em", { ascending: false })
      .returns<TimelineEventRow[]>(),
    supabase.from("investigacao_categorias").select("id, codigo, rotulo, ativo, ordem").order("ordem"),
    supabase.from("investigacao_graus").select("id, codigo, rotulo, ativo, ordem").order("ordem"),
    supabase.from("investigacao_causas").select("id, categoria_id, texto").eq("ativo", true).order("ordem"),
  ]);
  if (!rawRow) notFound();
  const row = rawRow as unknown as OcorrenciaSummary;

  const causasByCategoria: Record<string, Array<{ id: string; texto: string }>> = {};
  for (const c of (causasRes.data ?? [])) {
    (causasByCategoria[c.categoria_id] ??= []).push({ id: c.id, texto: c.texto });
  }

  const inv = row.investigacoes?.[0];
  const initialDados: InvestigacaoDados = (inv?.dados ?? EMPTY_DADOS) as InvestigacaoDados;
  const initialSituacao = inv?.situacao ?? "em_andamento";

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        breadcrumbs={[
          { label: "Painel", href: "/app/painel" },
          { label: "Ocorrências", href: "/app/ocorrencias" },
          { label: ocorrenciaTipoLabel(row.tipo), href: `/app/ocorrencias/${row.id}` },
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
        <InvestigacaoForm
          ocorrenciaId={row.id}
          initialDados={initialDados}
          initialSituacao={initialSituacao}
          tokenPublico={inv?.token_publico ?? ""}
          categorias={categorias ?? []}
          graus={graus ?? []}
          causasByCategoria={causasByCategoria}
        />
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
