import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FileText } from "lucide-react";
import { requirePortalSession } from "@/lib/portal-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { StatusPill } from "@/components/data/status-pill";
import { EmptyState } from "@/components/data/empty-state";
import { KpiCard } from "@/components/painel/kpi-card";
import { fmtDate, fmtDateTime } from "@/lib/fmt-date";
import {
  ColaboradorSummaryCard,
  ColaboradorSummaryCardSkeleton,
} from "@/components/painel/colaborador-summary-card";
import { findActiveAfastamento } from "@/lib/portal-status";

type AfastamentoRow = {
  id: string;
  serial_id: number | null;
  situacao: string;
  data_inicio: string;
  data_fim: string | null;
  duracao: number | null;
  colaborador_nome: string | null;
  colaborador_cargo: string | null;
  colaborador_setor: string | null;
  empresa_id: string;
  cid: string | null;
  afastamento_tipos: { rotulo: string };
  empresas: { nome: string; codigo_soc: string | null };
  unidades: { nome: string } | null;
};

const COLUMNS: DataTableColumn<AfastamentoRow>[] = [
  { key: "serial", label: "#", mono: true, render: (r) => r.serial_id != null ? `#${r.serial_id}` : "—" },
  { key: "tipo",     label: "Tipo",     render: (r) => r.afastamento_tipos.rotulo },
  { key: "inicio",   label: "Início",   render: (r) => fmtDateTime(r.data_inicio, "00:00"), mono: true },
  { key: "fim",      label: "Fim",      render: (r) => r.data_fim ? fmtDateTime(r.data_fim, "23:59") : "—", mono: true },
  { key: "duracao",  label: "Duração",  render: (r) => (r.duracao ? `${r.duracao} dias` : "—") },
  { key: "cid",      label: "CID",      render: (r) => r.cid ?? "—", mono: true },
  {
    key: "situacao",
    label: "Situação",
    render: (r) => <StatusPill domain="afastamento" situacao={r.situacao} />,
  },
];

export default async function PortalPainelPage() {
  const session = await requirePortalSession();
  if (!session) redirect("/portal/login");

  const admin = getSupabaseAdmin();

  const [{ data: config }, { data: rows }] = await Promise.all([
    admin
      .from("configuracoes")
      .select("portal_saudacao, portal_vazio, portal_banner")
      .eq("id", 1)
      .single(),
    admin
      .from("afastamentos")
      .select(
        "id, serial_id, situacao, data_inicio, data_fim, duracao, colaborador_nome, colaborador_cargo, colaborador_setor, empresa_id, cid, afastamento_tipos!inner(rotulo), empresas!inner(nome, codigo_soc), unidades(nome)",
      )
      .eq("cpf", session.cpf)
      .order("criado_em", { ascending: false })
      .returns<AfastamentoRow[]>(),
  ]);

  const nome = rows?.[0]?.colaborador_nome ?? "colaborador";
  const saudacao  = (config?.portal_saudacao ?? "Olá, {nome}.").replace("{nome}", nome);
  const banner    = config?.portal_banner ?? "";
  const textoVazio = config?.portal_vazio ?? "Nenhum afastamento registrado.";

  const total = rows?.length ?? 0;
  const last = rows?.[0];
  const todayIso = new Date().toISOString().slice(0, 10);
  const activeAfastamento = findActiveAfastamento(rows, todayIso);
  const isAfastado = activeAfastamento != null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{saudacao}</h1>
        {banner && <p className="text-sm text-[var(--color-fg-muted)]">{banner}</p>}
      </header>
      {total > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            label="Total de afastamentos"
            value={total}
          />
          <KpiCard
            label="Último afastamento"
            value={
              last!.data_fim
                ? `${fmtDate(last!.data_inicio)} → ${fmtDate(last!.data_fim)}`
                : fmtDate(last!.data_inicio)
            }
          />
          <KpiCard
            label="Status atual"
            value={isAfastado ? "Afastado" : "Sem afastamento ativo"}
            delta={isAfastado && activeAfastamento!.data_fim ? (() => {
              const [y, m, d] = activeAfastamento!.data_fim.split("-").map(Number);
              const next = new Date(y, m - 1, d + 1);
              const ry = next.getFullYear();
              const rm = String(next.getMonth() + 1).padStart(2, "0");
              const rd = String(next.getDate()).padStart(2, "0");
              return `Retorno em ${rm}/${rd}/${ry}`;
            })() : undefined}
            tone={isAfastado ? "warning" : "primary"}
          />
        </div>
      )}
      {rows && rows.length > 0 && rows[0].empresas.codigo_soc && (
        <Suspense fallback={<ColaboradorSummaryCardSkeleton />}>
          <ColaboradorSummaryCard
            cpf={session.cpf}
            empresaCodigoSoc={rows[0].empresas.codigo_soc}
            fallback={{
              nome: rows[0].colaborador_nome,
              cargo: rows[0].colaborador_cargo,
              setor: rows[0].colaborador_setor,
              unidade_nome: rows[0].unidades?.nome ?? null,
            }}
          />
        </Suspense>
      )}
      <DataTable
        rows={rows ?? []}
        columns={COLUMNS}
        getRowId={(r) => r.id}
        getRowHref={(r) => `/portal/afastamentos/${r.id}`}
        empty={<EmptyState icon={FileText} title={textoVazio} />}
      />
    </div>
  );
}
