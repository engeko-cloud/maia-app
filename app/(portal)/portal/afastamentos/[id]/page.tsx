import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requirePortalSession } from "@/lib/portal-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { FieldGrid, type Field } from "@/components/detail/field-grid";
import { fmtDateWithHora } from "@/lib/fmt-date";
import { StatusPill } from "@/components/data/status-pill";

type DetailRow = {
  id: string;
  situacao: string;
  cpf: string;
  data_inicio: string;
  data_fim: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  duracao: number | null;
  colaborador_nome: string | null;
  motivo_rejeicao: string | null;
  afastamento_tipos: { rotulo: string };
  empresas: { nome: string };
  unidades: { nome: string };
  serial_id: number | null;
};

export default async function PortalAfastamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requirePortalSession();
  if (!session) redirect("/portal/login");

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("afastamentos")
    .select(
      "id, situacao, cpf, data_inicio, data_fim, hora_inicio, hora_fim, duracao, colaborador_nome, motivo_rejeicao, serial_id, afastamento_tipos!inner(rotulo), empresas!inner(nome), unidades!inner(nome)",
    )
    .eq("id", id)
    .single<DetailRow>();

  // Explicit CPF check replaces RLS — ensure this colaborador owns the record.
  if (!row || row.cpf !== session.cpf) notFound();

  const fields: Field[] = [
    { label: "#", value: row.serial_id != null ? `#${row.serial_id}` : "—", mono: true },
    { label: "Tipo",     value: row.afastamento_tipos.rotulo },
    { label: "Empresa",  value: row.empresas.nome },
    { label: "Unidade",  value: row.unidades.nome },
    { label: "Início",   value: fmtDateWithHora(row.data_inicio, row.hora_inicio), mono: true },
    { label: "Fim",      value: row.data_fim ? fmtDateWithHora(row.data_fim, row.hora_fim) : "—", mono: true },
    { label: "Duração",  value: row.duracao ? `${row.duracao} dias` : "—" },
    { label: "Situação", value: <StatusPill domain="afastamento" situacao={row.situacao} /> },
    ...(row.situacao === "rejeitado" && row.motivo_rejeicao
      ? [{ label: "Motivo da rejeição", value: row.motivo_rejeicao, full: true as const }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div className="flex flex-col gap-1">
          <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
            <Link href="/portal/painel" className="hover:text-foreground">Minha Área</Link>
            <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
            <span aria-current="page" className="text-foreground">Afastamento</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight">Detalhes do afastamento</h1>
        </div>
        <Link
          href="/portal/painel"
          className="shrink-0 rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-fg-muted)] hover:text-foreground hover:border-[var(--color-fg-muted)] transition-colors"
        >
          ← Voltar à lista
        </Link>
      </header>
      <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
        <FieldGrid fields={fields} />
      </section>
    </div>
  );
}
