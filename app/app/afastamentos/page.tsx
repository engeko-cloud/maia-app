import Link from "next/link";
import { PlusIcon, ClipboardListIcon } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { FilterRail } from "@/components/data/filter-rail";
import { StatusPill } from "@/components/data/status-pill";
import { EmptyState } from "@/components/data/empty-state";
import { parseFilterParams } from "@/lib/filter-rail";
import { ExportDialog } from "@/components/relatorios/export-dialog";
import { fmtDate } from "@/lib/fmt-date";

interface AfastamentoRow {
  id: string;
  cpf: string;
  colaborador_nome: string;
  data_inicio: string;
  data_fim: string | null;
  situacao: string;
  cid: string | null;
  afastamento_tipos: { rotulo: string } | null;
}

export default async function AfastamentosListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { q, status } = parseFilterParams(sp);

  const supabase = await getSupabaseServer();
  let query = supabase
    .from("afastamentos")
    .select(
      "id, cpf, colaborador_nome, data_inicio, data_fim, situacao, cid, afastamento_tipos!inner(rotulo)",
    )
    .order("criado_em", { ascending: false })
    .limit(200);
  if (status) query = query.eq("situacao", status);
  if (q) {
    const safe = q.replace(/[%_,]/g, "");
    query = query.or(`colaborador_nome.ilike.%${safe}%,cpf.ilike.%${safe}%`);
  }
  const [{ data }, { data: empresasData }, { data: unidadesData }] = await Promise.all([
    query.returns<AfastamentoRow[]>(),
    supabase.from("empresas").select("id, nome").order("nome"),
    supabase.from("unidades").select("id, nome").order("nome"),
  ]);
  const rows     = data ?? [];
  const empresas = (empresasData ?? []) as { id: string; nome: string }[];
  const unidades = (unidadesData ?? []) as { id: string; nome: string }[];

  const columns: DataTableColumn<AfastamentoRow>[] = [
    {
      key: "colaborador",
      label: "Colaborador",
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium">{r.colaborador_nome}</span>
          <span className="font-mono text-xs text-[var(--color-fg-muted)]">
            {r.cpf}
          </span>
        </div>
      ),
    },
    {
      key: "tipo",
      label: "Tipo",
      render: (r) => r.afastamento_tipos?.rotulo ?? "—",
    },
    {
      key: "periodo",
      label: "Período",
      mono: true,
      render: (r) => `${fmtDate(r.data_inicio)} → ${r.data_fim ? fmtDate(r.data_fim) : "—"}`,
    },
    {
      key: "cid",
      label: "CID",
      render: (r) => r.cid ?? "—",
      mono: true,
    },
    {
      key: "situacao",
      label: "Situação",
      render: (r) => <StatusPill domain="afastamento" situacao={r.situacao} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div className="flex flex-col">
          <nav
            aria-label="Breadcrumb"
            className="text-xs text-[var(--color-fg-muted)]"
          >
            <Link href="/app/painel" className="hover:text-foreground">
              Painel
            </Link>
            <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
            <span aria-current="page" className="text-foreground">Afastamentos</span>
          </nav>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Afastamentos
          </h1>
          <p className="text-sm text-[var(--color-fg-muted)]">
            {rows.length} registro{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportDialog domain="afastamentos" empresas={empresas} unidades={unidades} />
          <Link
            href="/forms/afastamentos"
            className="relative inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary-600)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand-primary-700)]"
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            Novo afastamento
            <span
              aria-hidden="true"
              className="absolute -bottom-px left-2 right-2 h-[2px] bg-[var(--brand-accent-500)]"
            />
          </Link>
        </div>
      </header>

      <FilterRail
        basePath="/app/afastamentos"
        searchPlaceholder="Buscar por nome ou CPF…"
        chips={[
          { value: "", label: "Todos" },
          { value: "pendente", label: "Pendentes", tone: "urgent" },
          { value: "finalizado", label: "Finalizados" },
          { value: "rejeitado", label: "Rejeitados" },
          { value: "cancelado", label: "Cancelados" },
        ]}
      />

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        getRowHref={(r) => `/app/afastamentos/${r.id}`}
        empty={
          <EmptyState
            icon={ClipboardListIcon}
            title="Nenhum afastamento encontrado."
            hint="Ajuste os filtros ou registre um novo afastamento."
          />
        }
      />
    </div>
  );
}
