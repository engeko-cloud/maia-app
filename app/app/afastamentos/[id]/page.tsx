import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireEquipe } from "@/components/gates/equipe-only";
import { DetailHeader } from "@/components/detail/detail-header";
import { StatusPill } from "@/components/data/status-pill";
import { ApprovalBar } from "@/components/detail/approval-bar";
import { TimelineEvents, type TimelineEventRow } from "@/components/detail/timeline-events";
import { AfastamentoDetail, type AfastamentoFull } from "@/components/afastamentos/afastamento-detail";

async function userCanApprove(userId: string): Promise<boolean> {
  const supabase = await getSupabaseServer();
  const { data: u } = await supabase.from("usuarios").select("administrador").eq("id", userId).single();
  if (u?.administrador) return true;
  const { data: m } = await supabase
    .from("equipe_usuarios")
    .select("equipes!inner(codigo)")
    .eq("usuario_id", userId)
    .returns<{ equipes: { codigo: string } | null }[]>();
  return (m ?? []).some((row) => row.equipes?.codigo === "oh");
}

export default async function AfastamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireEquipe("oh");
  const { id } = await params;
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: rawRow }, { data: timelineData }] = await Promise.all([
    supabase
      .from("afastamentos")
      .select("*, empresas!inner(nome), unidades!inner(nome), afastamento_tipos!inner(rotulo)")
      .eq("id", id)
      .single(),
    supabase
      .from("eventos")
      .select("id, evento, ocorrido_em, usuarios:autor_id(nome)")
      .eq("tipo_entidade", "afastamento")
      .eq("entidade_id", id)
      .order("ocorrido_em", { ascending: false })
      .returns<TimelineEventRow[]>(),
  ]);
  if (!rawRow) notFound();
  const row = rawRow as unknown as AfastamentoFull;

  const canApprove = user ? await userCanApprove(user.id) : false;
  const showApprovalBar = row.situacao === "pendente" && canApprove;

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        breadcrumbs={[
          { label: "Painel", href: "/app/painel" },
          { label: "Afastamentos", href: "/app/afastamentos" },
          { label: row.colaborador_nome },
        ]}
        title={row.colaborador_nome}
        titleSuffix={row.cpf}
        meta={
          <>
            <StatusPill domain="afastamento" situacao={row.situacao} />
            <span>{row.afastamento_tipos?.rotulo ?? "—"}</span>
            <span className="font-mono">
              {row.data_inicio}
              {row.data_fim ? ` → ${row.data_fim}` : ""}
            </span>
          </>
        }
      />

      {showApprovalBar && <ApprovalBar afastamentoId={row.id} />}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <AfastamentoDetail a={row} />
        <aside className="flex flex-col gap-6">
          <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
              Histórico
            </h2>
            <TimelineEvents rows={timelineData ?? []} tipoEntidade="afastamento" />
          </section>
        </aside>
      </div>
    </div>
  );
}
