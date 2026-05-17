import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireEquipe } from "@/components/gates/equipe-only";
import { DetailHeader } from "@/components/detail/detail-header";
import { StatusPill } from "@/components/data/status-pill";
import { TimelineEvents, type TimelineEventRow } from "@/components/detail/timeline-events";
import { InvestigacaoForm } from "@/components/investigacoes/investigacao-form";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";
import { fmtDateTime } from "@/lib/fmt-date";

interface OcorrenciaSummary {
  id: string;
  tipo: string;
  situacao: string;
  data_ocorrencia: string;
}

const EMPTY_DADOS: InvestigacaoDados = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] };

function parseDados(raw: unknown): InvestigacaoDados {
  if (!raw) return EMPTY_DADOS;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as InvestigacaoDados; } catch { return EMPTY_DADOS; }
  }
  return raw as InvestigacaoDados;
}

export default async function InvestigacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireEquipe("safety");
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const [
    { data: rawRow },
    { data: invData },
    { data: timelineData },
    { data: categorias },
    { data: graus },
    causasRes,
  ] = await Promise.all([
    supabase
      .from("ocorrencias")
      .select("id, tipo, situacao, data_ocorrencia")
      .eq("id", id)
      .single(),
    supabase
      .from("investigacoes")
      .select("id, situacao, dados, token_publico")
      .eq("ocorrencia_id", id)
      .maybeSingle(),
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

  const initialDados: InvestigacaoDados = parseDados(invData?.dados);
  const initialSituacao = (invData?.situacao as "em_andamento" | "em_aprovacao" | "aprovada" | "rejeitada" | "cancelada" | undefined) ?? "em_andamento";

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
            <span className="font-mono">{fmtDateTime(row.data_ocorrencia)}</span>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <InvestigacaoForm
          ocorrenciaId={row.id}
          initialDados={initialDados}
          initialSituacao={initialSituacao}
          tokenPublico={(invData?.token_publico as string | null) ?? ""}
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
