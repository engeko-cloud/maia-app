import Link from "next/link";
import { ClipboardListIcon } from "lucide-react";
import { requireEquipe } from "@/components/gates/equipe-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { FilterRail, type FilterChip } from "@/components/data/filter-rail";
import { StatusPill } from "@/components/data/status-pill";
import { EmptyState } from "@/components/data/empty-state";
import { KpiCard } from "@/components/painel/kpi-card";
import { parseFilterParams } from "@/lib/filter-rail";
import { fmtDate } from "@/lib/fmt-date";

type AtivoRow = {
  id: string;
  serial_id: number | null;
  cpf: string;
  colaborador_nome: string;
  data_inicio: string;
  data_fim: string;
  duracao: number | null;
  cid: string | null;
  situacao: string;
  afastamento_tipos: { codigo: string; rotulo: string };
};

export default async function AfastamentosAtivosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireEquipe("oh");

  const sp = await searchParams;
  const { q: searchQ, status: tipoCodigo } = parseFilterParams(sp);

  // eslint-disable-next-line react-hooks/purity
  const today = new Date().toISOString().slice(0, 10);
  // eslint-disable-next-line react-hooks/purity
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  const supabase = await getSupabaseServer();

  let ativosQuery = supabase
    .from("afastamentos")
    .select(
      "id, serial_id, cpf, colaborador_nome, data_inicio, data_fim, duracao, cid, situacao, afastamento_tipos!inner(codigo, rotulo)",
    )
    .neq("situacao", "rejeitado")
    .neq("situacao", "pendente")
    .gte("data_fim", today)
    .order("data_fim", { ascending: true });

  if (tipoCodigo) {
    ativosQuery = ativosQuery.eq("afastamento_tipos.codigo", tipoCodigo);
  }

  if (searchQ) {
    const safe = searchQ.replace(/[%_,]/g, "");
    ativosQuery = ativosQuery.or(`colaborador_nome.ilike.%${safe}%,cpf.ilike.%${safe}%`);
  }

  const [{ data }, { data: tiposData }] = await Promise.all([
    ativosQuery.returns<AtivoRow[]>(),
    supabase.from("afastamento_tipos").select("codigo, rotulo").eq("ativo", true).order("ordem"),
  ]);

  const rows = data ?? [];
  const tipos = tiposData ?? [];

  const total = rows.length;
  const prev31 = rows.filter((r) => r.afastamento_tipos.codigo === "prev_31").length;
  const prev91 = rows.filter((r) => r.afastamento_tipos.codigo === "prev_91").length;
  const thisWeek = rows.filter((r) => r.data_fim <= sevenDaysFromNow).length;

  const chips: FilterChip[] = [
    { value: "", label: "Todos" },
    ...tipos.map((t) => ({ value: t.codigo, label: t.rotulo })),
  ];

  const columns: DataTableColumn<AtivoRow>[] = [
    {
      key: "serial",
      label: "#",
      mono: true,
      render: (r) => (r.serial_id != null ? `#${r.serial_id}` : "—"),
    },
    {
      key: "colaborador",
      label: "Colaborador",
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium">{r.colaborador_nome}</span>
          <span className="font-mono text-xs text-[var(--color-fg-muted)]">{r.cpf}</span>
        </div>
      ),
    },
    {
      key: "tipo",
      label: "Tipo",
      render: (r) => r.afastamento_tipos?.rotulo ?? "—",
    },
    {
      key: "cid",
      label: "CID",
      mono: true,
      render: (r) => r.cid ?? "—",
    },
    {
      key: "inicio",
      label: "Início",
      mono: true,
      render: (r) => fmtDate(r.data_inicio),
    },
    {
      key: "fim",
      label: "Fim",
      mono: true,
      render: (r) => fmtDate(r.data_fim),
    },
    {
      key: "dias",
      label: "Dias",
      mono: true,
      render: (r) => (r.duracao != null ? String(r.duracao) : "—"),
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
          <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
            <Link href="/app/painel" className="hover:text-foreground">
              Painel
            </Link>
            <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
            <Link href="/app/afastamentos" className="hover:text-foreground">
              Afastamentos
            </Link>
            <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
            <span aria-current="page" className="text-foreground">
              Ativos
            </span>
          </nav>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Afastamentos Ativos</h1>
          <p className="text-sm text-[var(--color-fg-muted)]">
            {total} colaborador{total === 1 ? "" : "es"} afastado{total === 1 ? "" : "s"} hoje
          </p>
        </div>
      </header>

      {total > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Total afastados" value={total} />
          <KpiCard label="Prev. 31 — Doença comum" value={prev31} tone="primary" />
          <KpiCard label="Prev. 91 — Acidente/ocupacional" value={prev91} tone="accent" />
          <KpiCard label="Retornam esta semana" value={thisWeek} tone="warning" />
        </div>
      )}

      <FilterRail
        basePath="/app/afastamentos/ativos"
        searchPlaceholder="Buscar por nome ou CPF…"
        chips={chips}
      />

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        getRowHref={(r) => `/app/afastamentos/${r.id}`}
        getRowClassName={(r) =>
          r.data_fim <= sevenDaysFromNow ? "bg-[var(--color-bg-subtle)]" : undefined
        }
        empty={
          <EmptyState
            icon={ClipboardListIcon}
            title="Nenhum afastamento ativo encontrado."
            hint="Não há colaboradores afastados no momento ou ajuste os filtros."
          />
        }
      />
    </div>
  );
}
