import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { requirePortalSession } from "@/lib/portal-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { StatusPill } from "@/components/data/status-pill";
import { EmptyState } from "@/components/data/empty-state";
import { KpiCard } from "@/components/painel/kpi-card";

type AfastamentoRow = {
  id: string;
  situacao: string;
  data_inicio: string;
  data_fim: string | null;
  duracao: number | null;
  colaborador_nome: string | null;
  afastamento_tipos: { rotulo: string };
  empresas: { nome: string };
};

function fmtDate(iso: string, defaultTime: string): string {
  const [datePart, timePart] = iso.includes("T") ? iso.split("T") : [iso, ""];
  const [y, m, d] = datePart.split("-");
  const time = timePart ? timePart.slice(0, 5) : defaultTime;
  return `${m}/${d}/${y} ${time}`;
}

function fmtDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const datePart = iso.includes("T") ? iso.split("T")[0] : iso;
  const [y, m, d] = datePart.split("-");
  return `${m}/${d}/${y}`;
}

function nextDayFmt(iso: string): string {
  const datePart = iso.includes("T") ? iso.split("T")[0] : iso;
  const [y, m, d] = datePart.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d) + 1);
  const ry = date.getFullYear();
  const rm = String(date.getMonth() + 1).padStart(2, "0");
  const rd = String(date.getDate()).padStart(2, "0");
  return `${rm}/${rd}/${ry}`;
}

const COLUMNS: DataTableColumn<AfastamentoRow>[] = [
  { key: "tipo",     label: "Tipo",     render: (r) => r.afastamento_tipos.rotulo },
  { key: "inicio",   label: "Início",   render: (r) => fmtDate(r.data_inicio, "00:00"), mono: true },
  { key: "fim",      label: "Fim",      render: (r) => r.data_fim ? fmtDate(r.data_fim, "23:59") : "—", mono: true },
  { key: "duracao",  label: "Duração",  render: (r) => (r.duracao ? `${r.duracao} dias` : "—") },
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
        "id, situacao, data_inicio, data_fim, duracao, colaborador_nome, afastamento_tipos!inner(rotulo), empresas!inner(nome)",
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
  const now = new Date();
  const activeAfastamento = rows?.find(
    (r) => r.situacao === "aprovado" && r.data_fim != null && new Date(r.data_fim) > now,
  );
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
            value={`${fmtDateOnly(last!.data_inicio)} → ${fmtDateOnly(last!.data_fim!)}`}
          />
          <KpiCard
            label="Status atual"
            value={isAfastado ? "Afastado" : "Sem afastamento ativo"}
            delta={isAfastado ? `Retorno em ${nextDayFmt(activeAfastamento!.data_fim!)}` : undefined}
            tone={isAfastado ? "warning" : "primary"}
          />
        </div>
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
