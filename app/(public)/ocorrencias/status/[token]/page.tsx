import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PublicFormShell } from "@/components/forms/public-form-shell";
import { InvestigacaoDataView } from "@/components/investigacoes/investigacao-data-view";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";
import { fmtDateTime } from "@/lib/fmt-date";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

const EMPTY_DADOS: InvestigacaoDados = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] };

function parseDados(raw: unknown): InvestigacaoDados {
  if (!raw) return EMPTY_DADOS;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as InvestigacaoDados; } catch { return EMPTY_DADOS; }
  }
  return raw as InvestigacaoDados;
}

function nome(join: unknown): string {
  if (Array.isArray(join)) return (join[0] as { nome: string })?.nome ?? "—";
  return (join as { nome: string } | null)?.nome ?? "—";
}

const SITUACAO_LABEL: Record<string, string> = {
  aberta:          "Aberta",
  em_investigacao: "Em investigação",
  finalizada:      "Finalizada",
  cancelada:       "Cancelada",
  concluida:       "Concluída",
};

const SITUACAO_TONE: Record<string, string> = {
  aberta:          "bg-yellow-50 text-yellow-800 border-yellow-200",
  em_investigacao: "bg-blue-50 text-blue-800 border-blue-200",
  finalizada:      "bg-green-50 text-green-800 border-green-200",
  concluida:       "bg-green-50 text-green-800 border-green-200",
  cancelada:       "bg-gray-100 text-gray-700 border-gray-200",
};

export default async function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: o } = await supabase
    .from("ocorrencias")
    .select(`
      id, serial_id, situacao, tipo, data_ocorrencia, descricao,
      colaborador_nome, cpf,
      empresas!inner(nome),
      unidades!inner(nome)
    `)
    .eq("token_edicao", token)
    .single();

  if (!o) notFound();

  const [{ data: inv }, { data: categoriasData }, { data: grausData }] = await Promise.all([
    supabase
      .from("investigacoes")
      .select("id, situacao, dados, token_publico, motivo_rejeicao")
      .eq("ocorrencia_id", o.id)
      .maybeSingle(),
    supabase.from("investigacao_categorias").select("id, codigo, rotulo").eq("ativo", true),
    supabase.from("investigacao_graus").select("id, rotulo").eq("ativo", true),
  ]);

  const categoriasById = Object.fromEntries(
    (categoriasData ?? []).map((c) => [c.id, { rotulo: c.rotulo, codigo: c.codigo }]),
  );
  const grausById = Object.fromEntries(
    (grausData ?? []).map((g) => [g.id, { rotulo: g.rotulo }]),
  );
  const storagePublicBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/attachments/`;

  const idLabel = o.serial_id != null ? `#${o.serial_id}` : "—";
  const tone = SITUACAO_TONE[o.situacao] ?? SITUACAO_TONE.aberta;
  const invDados = parseDados(inv?.dados);

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
        <dd>{fmtDateTime(o.data_ocorrencia)}</dd>
        <dt className="text-[var(--color-fg-muted)]">Colaborador</dt>
        <dd>{o.colaborador_nome ?? "—"}{o.cpf ? ` (${o.cpf})` : ""}</dd>
        <dt className="text-[var(--color-fg-muted)]">Empresa</dt>
        <dd>{nome(o.empresas)}</dd>
        <dt className="text-[var(--color-fg-muted)]">Unidade</dt>
        <dd>{nome(o.unidades)}</dd>
        <dt className="text-[var(--color-fg-muted)]">Descrição</dt>
        <dd>{o.descricao ?? "—"}</dd>
      </dl>

      {inv && (
        <div className="mt-6 border-t border-[var(--color-border)] pt-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
            Investigação
          </h2>
          <InvestigacaoDataView
            dados={invDados}
            categoriasById={categoriasById}
            grausById={grausById}
            storagePublicBase={storagePublicBase}
          />
          {(inv.situacao === "em_andamento" || inv.situacao === "rejeitada") && (
            <div className="mt-4">
              <Link
                href={`/investigacoes/editar/${inv.token_publico}`}
                className="text-sm font-medium text-[var(--brand-primary-600)] hover:underline"
              >
                Editar investigação →
              </Link>
            </div>
          )}
        </div>
      )}
    </PublicFormShell>
  );
}
