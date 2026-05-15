import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getEmailsFalhados,
  getFluigFalhados,
  getAprovacaoLatencia,
  getOcorrenciasPorSituacao,
  getAfastosPorTipo,
  getAnexosStatus,
  getThresholdHoras,
  type SaudeMetrics,
} from "@/lib/dashboard/queries";
import { SaudeClient } from "@/components/saude/saude-client";

export default async function PainelSaudePage() {
  const me = await requireAdminUser();
  if (!me) redirect("/painel");

  const admin = getSupabaseAdmin();

  const [
    emails_falhados,
    fluig_falhados,
    latencia,
    ocorrencias_por_situacao,
    afastos_por_tipo,
    anexos,
    threshold_horas,
  ] = await Promise.all([
    getEmailsFalhados(admin),
    getFluigFalhados(admin),
    getAprovacaoLatencia(admin),
    getOcorrenciasPorSituacao(admin),
    getAfastosPorTipo(admin),
    getAnexosStatus(admin),
    getThresholdHoras(admin),
  ]);

  const initial: SaudeMetrics = {
    emails_falhados,
    fluig_falhados,
    aprovacao_p50_horas: latencia.p50_horas,
    aprovacao_p95_horas: latencia.p95_horas,
    ocorrencias_por_situacao,
    afastos_por_tipo,
    anexos_presentes: anexos.presentes,
    anexos_ausentes: anexos.ausentes,
    threshold_horas,
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
          Painel · Saúde do sistema
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Saúde operacional</h1>
      </header>
      <SaudeClient initial={initial} />
    </div>
  );
}
