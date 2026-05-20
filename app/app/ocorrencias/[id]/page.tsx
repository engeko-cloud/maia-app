import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireEquipe } from "@/components/gates/equipe-only";
import { DetailHeader } from "@/components/detail/detail-header";
import { StatusPill } from "@/components/data/status-pill";
import { TimelineEvents, type TimelineEventRow } from "@/components/detail/timeline-events";
import { OcorrenciaDetailCard, type OcorrenciaFull } from "@/components/ocorrencias/ocorrencia-detail-card";
import { InvestigacaoDetailSection } from "@/components/investigacoes/investigacao-detail-section";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";
import { fmtDateTime } from "@/lib/fmt-date";

const EMPTY_DADOS: InvestigacaoDados = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] };

function parseDados(raw: unknown): InvestigacaoDados {
  if (!raw) return EMPTY_DADOS;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as InvestigacaoDados; } catch { return EMPTY_DADOS; }
  }
  return raw as InvestigacaoDados;
}

export default async function OcorrenciaDetailPage({
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
    { data: categoriasData },
    { data: grausData },
  ] = await Promise.all([
    supabase
      .from("ocorrencias")
      .select("*, empresas!inner(nome), unidades!inner(nome)")
      .eq("id", id)
      .single(),
    supabase
      .from("investigacoes")
      .select("id, situacao, dados, token_publico, motivo_rejeicao")
      .eq("ocorrencia_id", id)
      .maybeSingle(),
    supabase
      .from("eventos")
      .select("id, evento, ocorrido_em, usuarios:autor_id(nome)")
      .eq("tipo_entidade", "ocorrencia")
      .eq("entidade_id", id)
      .order("ocorrido_em", { ascending: false })
      .returns<TimelineEventRow[]>(),
    supabase
      .from("investigacao_categorias")
      .select("id, codigo, rotulo")
      .eq("ativo", true),
    supabase
      .from("investigacao_graus")
      .select("id, rotulo")
      .eq("ativo", true),
  ]);

  if (!rawRow) notFound();
  const row = rawRow as unknown as OcorrenciaFull;

  const categoriasById = Object.fromEntries(
    (categoriasData ?? []).map((c) => [c.id, { rotulo: c.rotulo, codigo: c.codigo }]),
  );
  const grausById = Object.fromEntries(
    (grausData ?? []).map((g) => [g.id, { rotulo: g.rotulo }]),
  );
  const storagePublicBase = "/api/public/investigacoes/preview?path=";

  const inv = invData
    ? {
        situacao: invData.situacao as "em_andamento" | "em_aprovacao" | "aprovada" | "rejeitada" | "cancelada",
        dados: parseDados(invData.dados),
        token_publico: invData.token_publico as string,
        motivo_rejeicao: invData.motivo_rejeicao as string | null,
      }
    : {
        situacao: "em_andamento" as const,
        dados: EMPTY_DADOS,
        token_publico: "",
        motivo_rejeicao: null,
      };

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        breadcrumbs={[
          { label: "Painel", href: "/app/painel" },
          { label: "Ocorrências", href: "/app/ocorrencias" },
          { label: ocorrenciaTipoLabel(row.tipo) },
        ]}
        title={ocorrenciaTipoLabel(row.tipo)}
        meta={
          <>
            <StatusPill domain="ocorrencia" situacao={row.situacao} />
            <span>{row.empresas?.nome ?? "—"}</span>
            <span className="font-mono">{fmtDateTime(row.data_ocorrencia)}</span>
          </>
        }
      />

      <InvestigacaoDetailSection
        ocorrenciaId={row.id}
        investigacao={{ ...inv, dados: inv.dados ?? EMPTY_DADOS }}
        categoriasById={categoriasById}
        grausById={grausById}
        storagePublicBase={storagePublicBase}
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
