import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireEquipe } from "@/components/gates/equipe-only";
import { DetailHeader } from "@/components/detail/detail-header";
import { StatusPill } from "@/components/data/status-pill";
import { ApprovalBar } from "@/components/detail/approval-bar";
import { TimelineEvents, type TimelineEventRow } from "@/components/detail/timeline-events";
import { AfastamentoDetail, type AfastamentoFull } from "@/components/afastamentos/afastamento-detail";
import { AttachmentChip } from "@/components/detail/attachment-chip";
import { Suspense } from "react";
import {
  AfastamentoHistoryCard,
  AfastamentoHistoryCardSkeleton,
} from "@/components/afastamentos/afastamento-history-card";
import { ComentariosCard, type Comentario } from "@/components/afastamentos/comentarios-card";
import { SendFinalizadoEmailCard } from "@/components/afastamentos/send-finalizado-email-card";

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

async function getIsAdmin(userId: string): Promise<boolean> {
  const supabase = await getSupabaseServer();
  const { data: u } = await supabase
    .from("usuarios")
    .select("administrador")
    .eq("id", userId)
    .single();
  return u?.administrador === true;
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

  const [
    { data: rawRow },
    { data: timelineData },
    { data: tiposData },
    { data: unidadesData },
    { data: comentariosData },
    { data: configRow },
  ] = await Promise.all([
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
    supabase
      .from("afastamento_tipos")
      .select("id, rotulo")
      .eq("requer_aprovacao", true)
      .order("ordem"),
    supabase
      .from("unidades")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("afastamento_comentarios")
      .select("id, autor_id, autor_nome, texto, anexos, criado_em, editado_em")
      .eq("afastamento_id", id)
      .order("criado_em", { ascending: false })
      .returns<Comentario[]>(),
    supabase
      .from("configuracoes")
      .select("email_folha")
      .eq("id", 1)
      .single(),
  ]);
  if (!rawRow) notFound();
  const row = rawRow as unknown as AfastamentoFull;

  const [canApprove, isAdmin] = await Promise.all([
    user ? userCanApprove(user.id) : Promise.resolve(false),
    user ? getIsAdmin(user.id) : Promise.resolve(false),
  ]);
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
        titleSuffix={`${row.serial_id != null ? `#${row.serial_id} · ` : ""}${row.cpf}`}
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

      {showApprovalBar && (
        <ApprovalBar
          afastamentoId={row.id}
          editProps={{
            tipos: (tiposData ?? []) as { id: string; rotulo: string }[],
            unidades: (unidadesData ?? []) as { id: string; nome: string }[],
            initialValues: {
              tipo_id: row.tipo_id,
              unidade_id: row.unidade_id,
              data_inicio: row.data_inicio,
              duracao: row.duracao,
              cid: row.cid,
              emissor: row.emissor,
            },
          }}
        />
      )}

      {row.arquivo_url && (
        <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
            Anexo
          </h2>
          <AttachmentChip
            href={`/api/private/anexos/preview?path=${encodeURIComponent(row.arquivo_url)}`}
            filename={row.arquivo_url.split("/").pop() ?? "anexo"}
          />
        </section>
      )}

      {row.situacao === "finalizado" && (
        <SendFinalizadoEmailCard
          afastamentoId={row.id}
          defaultEmail={configRow?.email_folha ?? null}
        />
      )}

      <Suspense fallback={<AfastamentoHistoryCardSkeleton />}>
        <AfastamentoHistoryCard cpf={row.cpf} currentId={id} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <AfastamentoDetail a={row} />
        <aside className="flex flex-col gap-4">
          <ComentariosCard
            afastamentoId={row.id}
            comentarios={comentariosData ?? []}
            currentUserId={user?.id ?? ""}
            isAdmin={isAdmin}
          />
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
