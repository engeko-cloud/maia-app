import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PublicFormShell } from "@/components/forms/public-form-shell";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";

const SITUACAO_LABEL: Record<string, string> = {
  aberta:           "Aberta",
  em_investigacao:  "Em investigação",
  finalizada:       "Finalizada",
  cancelada:        "Cancelada",
  concluida:        "Concluída",
};

const SITUACAO_TONE: Record<string, string> = {
  aberta:           "bg-yellow-50 text-yellow-800 border-yellow-200",
  em_investigacao:  "bg-blue-50 text-blue-800 border-blue-200",
  finalizada:       "bg-green-50 text-green-800 border-green-200",
  concluida:        "bg-green-50 text-green-800 border-green-200",
  cancelada:        "bg-gray-100 text-gray-700 border-gray-200",
};

export default async function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: o } = await supabase
    .from("ocorrencias")
    .select(`
      serial_id, situacao, tipo, data_ocorrencia, descricao,
      colaborador_nome, cpf,
      empresas!inner(nome),
      unidades!inner(nome)
    `)
    .eq("token_edicao", token)
    .single();

  if (!o) notFound();

  const idLabel = o.serial_id != null ? `#${o.serial_id}` : "—";
  const tone = SITUACAO_TONE[o.situacao] ?? SITUACAO_TONE.aberta;

  return (
    <PublicFormShell
      title={`Ocorrência ${idLabel}`}
      banner="Acompanhamento da sua ocorrência. Esta página atualiza conforme a equipe de segurança avança na investigação."
    >
      <div className={`mb-4 rounded-md border px-3 py-2 text-sm font-medium ${tone}`}>
        Situação atual: {SITUACAO_LABEL[o.situacao] ?? o.situacao}
      </div>

      <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-4">
        <dt className="text-[var(--color-fg-muted)]">Identificador</dt>
        <dd>{idLabel}</dd>
        <dt className="text-[var(--color-fg-muted)]">Tipo</dt>
        <dd>{ocorrenciaTipoLabel(o.tipo)}</dd>
        <dt className="text-[var(--color-fg-muted)]">Data</dt>
        <dd>{new Date(o.data_ocorrencia).toLocaleString("pt-BR")}</dd>
        <dt className="text-[var(--color-fg-muted)]">Colaborador</dt>
        <dd>{o.colaborador_nome ?? "—"}{o.cpf ? ` (${o.cpf})` : ""}</dd>
        <dt className="text-[var(--color-fg-muted)]">Empresa</dt>
        <dd>{o.empresas.nome}</dd>
        <dt className="text-[var(--color-fg-muted)]">Unidade</dt>
        <dd>{o.unidades.nome}</dd>
        <dt className="text-[var(--color-fg-muted)]">Descrição</dt>
        <dd>{o.descricao ?? "—"}</dd>
      </dl>
    </PublicFormShell>
  );
}
