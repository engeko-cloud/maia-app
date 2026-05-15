import { NextResponse } from "next/server";
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

export async function GET() {
  const me = await requireAdminUser();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

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

  const payload: SaudeMetrics = {
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

  return NextResponse.json(payload);
}
