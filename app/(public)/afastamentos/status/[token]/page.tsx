import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PublicFormShell } from "@/components/forms/public-form-shell";
import { AttachmentChip } from "@/components/detail/attachment-chip";
import { fmtDateWithHora } from "@/lib/fmt-date";

const SITUACAO_LABEL: Record<string, string> = {
  pendente:   "Pendente de aprovação",
  rejeitado:  "Rejeitado",
  finalizado: "Finalizado",
  cancelado:  "Cancelado",
};

const SITUACAO_TONE: Record<string, string> = {
  pendente:   "bg-yellow-50 text-yellow-800 border-yellow-200",
  rejeitado:  "bg-red-50 text-red-800 border-red-200",
  finalizado: "bg-green-50 text-green-800 border-green-200",
  cancelado:  "bg-gray-100 text-gray-700 border-gray-200",
};

export default async function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: a } = await supabase
    .from("afastamentos")
    .select(`
      serial_id, situacao, motivo_rejeicao,
      colaborador_nome, cpf, data_inicio, data_fim, hora_inicio, hora_fim, duracao, cid, arquivo_url,
      empresas!inner(nome),
      unidades!inner(nome),
      afastamento_tipos!inner(rotulo)
    `)
    .eq("token_edicao", token)
    .single();

  if (!a) notFound();

  const idLabel = a.serial_id != null ? `#${a.serial_id}` : "—";
  const tone = SITUACAO_TONE[a.situacao] ?? SITUACAO_TONE.pendente;

  return (
    <PublicFormShell
      title={`Afastamento ${idLabel}`}
      banner="Acompanhamento do seu afastamento. Esta página atualiza conforme o RH avalia o registro."
    >
      <div className={`mb-4 rounded-md border px-3 py-2 text-sm font-medium ${tone}`}>
        Situação atual: {SITUACAO_LABEL[a.situacao] ?? a.situacao}
      </div>

      {a.situacao === "rejeitado" && a.motivo_rejeicao ? (
        <div className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-accent-soft)] px-3 py-2 text-sm">
          <strong>Motivo da rejeição:</strong> {a.motivo_rejeicao}
        </div>
      ) : null}

      <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-4">
        <dt className="text-[var(--color-fg-muted)]">Identificador</dt>
        <dd>{idLabel}</dd>
        <dt className="text-[var(--color-fg-muted)]">Colaborador</dt>
        <dd>{a.colaborador_nome ?? "—"} ({a.cpf})</dd>
        <dt className="text-[var(--color-fg-muted)]">Tipo</dt>
        <dd>{(a.afastamento_tipos as { rotulo: string }).rotulo}</dd>
        <dt className="text-[var(--color-fg-muted)]">Período</dt>
        <dd>{fmtDateWithHora(a.data_inicio, a.hora_inicio)} → {a.data_fim ? fmtDateWithHora(a.data_fim, a.hora_fim) : "—"} {a.duracao ? `(${a.duracao} dia${a.duracao > 1 ? "s" : ""})` : ""}</dd>
        <dt className="text-[var(--color-fg-muted)]">CID</dt>
        <dd>{a.cid ?? "—"}</dd>
        <dt className="text-[var(--color-fg-muted)]">Empresa</dt>
        <dd>{(a.empresas as { nome: string }).nome}</dd>
        <dt className="text-[var(--color-fg-muted)]">Unidade</dt>
        <dd>{(a.unidades as { nome: string }).nome}</dd>
      </dl>

      {a.arquivo_url ? (
        <div className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
            Anexo
          </h2>
          <AttachmentChip
            href={`/api/public/afastamentos/${token}/anexo`}
            filename={a.arquivo_url.split("/").pop() ?? "anexo"}
          />
        </div>
      ) : null}

      {a.situacao === "rejeitado" ? (
        <div className="mt-6">
          <Link
            href={`/afastamentos/editar/${token}`}
            className="inline-flex items-center rounded-md bg-[var(--brand-primary-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-primary-700)]"
          >
            Corrigir e reenviar
          </Link>
        </div>
      ) : null}
    </PublicFormShell>
  );
}
