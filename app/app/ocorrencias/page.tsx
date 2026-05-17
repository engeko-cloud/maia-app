import Link from "next/link";
import { PlusIcon, AlertTriangleIcon } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { FilterRail } from "@/components/data/filter-rail";
import { StatusPill } from "@/components/data/status-pill";
import { EmptyState } from "@/components/data/empty-state";
import { parseFilterParams } from "@/lib/filter-rail";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";
import { ExportDialog } from "@/components/relatorios/export-dialog";

interface OcorrenciaRow {
  id: string;
  tipo: string;
  situacao: string;
  data_ocorrencia: string;
  empresas: { nome: string } | null;
}

export default async function OcorrenciasListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { q, status } = parseFilterParams(sp);

  const supabase = await getSupabaseServer();
  let query = supabase
    .from("ocorrencias")
    .select("id, tipo, situacao, data_ocorrencia, empresas!inner(nome)")
    .order("criado_em", { ascending: false })
    .limit(200);
  if (status) query = query.eq("situacao", status);
  if (q) {
    const safe = q.replace(/[%_,]/g, "");
    query = query.or(`tipo.ilike.%${safe}%,descricao.ilike.%${safe}%`);
  }
  const [{ data }, { data: empresasData }, { data: unidadesData }] = await Promise.all([
    query.returns<OcorrenciaRow[]>(),
    supabase.from("empresas").select("id, nome").order("nome"),
    supabase.from("unidades").select("id, nome").order("nome"),
  ]);
  const rows     = data ?? [];
  const empresas = (empresasData ?? []) as { id: string; nome: string }[];
  const unidades = (unidadesData ?? []) as { id: string; nome: string }[];

  const columns: DataTableColumn<OcorrenciaRow>[] = [
    { key: "tipo", label: "Tipo", render: (r) => ocorrenciaTipoLabel(r.tipo) },
    { key: "empresa", label: "Empresa", render: (r) => r.empresas?.nome ?? "—" },
    {
      key: "data",
      label: "Data",
      mono: true,
      render: (r) => new Date(r.data_ocorrencia).toLocaleDateString("pt-BR"),
    },
    {
      key: "situacao",
      label: "Situação",
      render: (r) => <StatusPill domain="ocorrencia" situacao={r.situacao} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div className="flex flex-col">
          <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
            <Link href="/app/painel" className="hover:text-foreground">Painel</Link>
            <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
            <span aria-current="page" className="text-foreground">Ocorrências</span>
          </nav>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Ocorrências</h1>
          <p className="text-sm text-[var(--color-fg-muted)]">{rows.length} registro{rows.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportDialog domain="ocorrencias" empresas={empresas} unidades={unidades} />
          <Link
            href="/forms/ocorrencias"
            className="relative inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary-600)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand-primary-700)]"
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            Nova ocorrência
            <span aria-hidden="true" className="absolute -bottom-px left-2 right-2 h-[2px] bg-[var(--brand-accent-500)]" />
          </Link>
        </div>
      </header>

      <FilterRail
        basePath="/app/ocorrencias"
        searchPlaceholder="Buscar por tipo ou descrição…"
        chips={[
          { value: "",                label: "Todas" },
          { value: "aberta",          label: "Abertas",          tone: "urgent" },
          { value: "em_investigacao", label: "Em investigação" },
          { value: "concluida",       label: "Concluídas" },
        ]}
      />

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        getRowHref={(r) => `/app/ocorrencias/${r.id}`}
        empty={<EmptyState icon={AlertTriangleIcon} title="Nenhuma ocorrência encontrada." hint="Ajuste os filtros ou registre uma nova ocorrência." />}
      />
    </div>
  );
}
