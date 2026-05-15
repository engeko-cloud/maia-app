import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireColaborador } from "@/lib/portal-auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { FieldGrid, type Field } from "@/components/detail/field-grid";
import { StatusPill } from "@/components/data/status-pill";

type DetailRow = {
  id: string;
  situacao: string;
  data_inicio: string;
  data_fim: string | null;
  duracao: number | null;
  colaborador_nome: string | null;
  motivo_rejeicao: string | null;
  afastamento_tipos: { rotulo: string };
  empresas: { nome: string };
  unidades: { nome: string };
};

export default async function PortalAfastamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireColaborador();
  if (session.status !== "ok") redirect("/portal/login");

  const supabase = await getSupabaseServer();
  const { data: row } = await supabase
    .from("afastamentos")
    .select(
      "id, situacao, data_inicio, data_fim, duracao, colaborador_nome, motivo_rejeicao, afastamento_tipos!inner(rotulo), empresas!inner(nome), unidades!inner(nome)",
    )
    .eq("id", id)
    .single<DetailRow>();

  // RLS returns null if CPF does not match — treat as not found.
  if (!row) notFound();

  const fields: Field[] = [
    { label: "Tipo", value: row.afastamento_tipos.rotulo },
    { label: "Empresa", value: row.empresas.nome },
    { label: "Unidade", value: row.unidades.nome },
    { label: "Início", value: row.data_inicio, mono: true },
    { label: "Fim", value: row.data_fim ?? "—", mono: true },
    { label: "Duração", value: row.duracao ? `${row.duracao} dias` : "—" },
    { label: "Situação", value: <StatusPill domain="afastamento" situacao={row.situacao} /> },
    ...(row.situacao === "rejeitado" && row.motivo_rejeicao
      ? [{ label: "Motivo da rejeição", value: row.motivo_rejeicao, full: true as const }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/portal/painel" className="hover:text-foreground">
            Minha Área
          </Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">
            Afastamento
          </span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Detalhes do afastamento</h1>
      </header>

      <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
        <FieldGrid fields={fields} />
      </section>
    </div>
  );
}
