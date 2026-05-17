import { getSupabaseServer } from "@/lib/supabase/server";
import { StatusPill } from "@/components/data/status-pill";
import { fmtDate } from "@/lib/fmt-date";
import { ExportHistoryButton } from "./export-history-button";

type HistoryRow = {
  id: string;
  data_inicio: string;
  data_fim: string | null;
  duracao: number | null;
  cid: string | null;
  situacao: string;
};

type Props = { cpf: string; currentId: string };

export async function AfastamentoHistoryCard({ cpf, currentId }: Props) {
  const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  const supabase = await getSupabaseServer();

  const { data } = await supabase
    .from("afastamentos")
    .select("id, data_inicio, data_fim, duracao, cid, situacao")
    .eq("cpf", cpf)
    .neq("situacao", "rejeitado")
    .gte("data_inicio", cutoff)
    .order("data_inicio", { ascending: false })
    .returns<HistoryRow[]>();

  const rows = data ?? [];
  const total = rows.reduce((sum, r) => sum + (r.duracao ?? 0), 0);

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-white">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Histórico 60 dias
        </h2>
        <ExportHistoryButton cpf={cpf} />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            <th className="px-5 py-2 text-left font-semibold">Início</th>
            <th className="px-5 py-2 text-left font-semibold">Fim</th>
            <th className="px-5 py-2 text-left font-semibold">Duração</th>
            <th className="px-5 py-2 text-left font-semibold">CID</th>
            <th className="px-5 py-2 text-left font-semibold">Situação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className={`border-b border-[var(--color-border)] last:border-0 ${
                r.id === currentId ? "bg-[var(--color-bg-subtle)]" : ""
              }`}
            >
              <td className="px-5 py-2 font-mono">{fmtDate(r.data_inicio)}</td>
              <td className="px-5 py-2 font-mono">{r.data_fim ? fmtDate(r.data_fim) : "—"}</td>
              <td className="px-5 py-2">{r.duracao != null ? `${r.duracao} dias` : "—"}</td>
              <td className="px-5 py-2 font-mono">{r.cid ?? "—"}</td>
              <td className="px-5 py-2">
                <StatusPill domain="afastamento" situacao={r.situacao} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--color-border)] font-semibold">
            <td className="px-5 py-2 text-[var(--color-fg-muted)]">Total</td>
            <td className="px-5 py-2 text-[var(--color-fg-muted)]">—</td>
            <td className="px-5 py-2">{total} dias</td>
            <td className="px-5 py-2 text-[var(--color-fg-muted)]">—</td>
            <td className="px-5 py-2 text-[var(--color-fg-muted)]">—</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function AfastamentoHistoryCardSkeleton() {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-white">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
        <div className="h-3 w-28 animate-pulse rounded bg-[var(--color-border)]" />
        <div className="h-8 w-36 animate-pulse rounded-md bg-[var(--color-border)]" />
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-6 px-5 py-3">
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="h-4 w-20 animate-pulse rounded bg-[var(--color-border)]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
