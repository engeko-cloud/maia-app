import Link from "next/link";
import { requireEquipe } from "@/components/gates/equipe-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { StatusPill } from "@/components/data/status-pill";
import { EmptyState } from "@/components/data/empty-state";
import { SearchIcon } from "lucide-react";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";

interface InvestigacaoRow {
  id: string;
  situacao: string;
  ocorrencias: {
    id: string;
    tipo: string;
    data_ocorrencia: string;
    empresas: { nome: string } | null;
  } | null;
}

export default async function InvestigacoesPage() {
  await requireEquipe("safety");
  const supabase = await getSupabaseServer();

  const { data } = await supabase
    .from("investigacoes")
    .select("id, situacao, ocorrencias!inner(id, tipo, data_ocorrencia, empresas!inner(nome))")
    .in("situacao", ["em_andamento", "em_aprovacao", "rejeitada"])
    .order("criado_em", { ascending: false })
    .limit(200)
    .returns<InvestigacaoRow[]>();

  const rows = data ?? [];

  const columns: DataTableColumn<InvestigacaoRow>[] = [
    {
      key: "tipo",
      label: "Tipo",
      render: (r) => ocorrenciaTipoLabel(r.ocorrencias?.tipo ?? ""),
    },
    {
      key: "empresa",
      label: "Empresa",
      render: (r) => r.ocorrencias?.empresas?.nome ?? "—",
    },
    {
      key: "data",
      label: "Data ocorrência",
      mono: true,
      render: (r) =>
        r.ocorrencias
          ? new Date(r.ocorrencias.data_ocorrencia).toLocaleDateString("pt-BR")
          : "—",
    },
    {
      key: "situacao",
      label: "Situação",
      render: (r) => <StatusPill domain="investigacao" situacao={r.situacao} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/app/painel" className="hover:text-foreground">Painel</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">Investigações</span>
        </nav>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Investigações</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          {rows.length} investigaç{rows.length === 1 ? "ão" : "ões"} em aberto
        </p>
      </header>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        getRowHref={(r) => r.ocorrencias ? `/app/ocorrencias/${r.ocorrencias.id}` : "#"}
        empty={
          <EmptyState
            icon={SearchIcon}
            title="Nenhuma investigação"
            hint="Todas as investigações foram resolvidas ou não há ocorrências registradas."
          />
        }
      />
    </div>
  );
}
