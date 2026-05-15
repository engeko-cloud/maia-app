import type { SupabaseClient } from "@supabase/supabase-js";

export type FailedItem = {
  id: string;
  colaborador_nome: string;
  tipo: string;
};

export type FailedGroup = { count: number; items: FailedItem[] };

export type SaudeMetrics = {
  emails_falhados: FailedGroup;
  fluig_falhados: FailedGroup;
  aprovacao_p50_horas: number | null;
  aprovacao_p95_horas: number | null;
  ocorrencias_por_situacao: Array<{ situacao: string; count: number }>;
  afastos_por_tipo: Array<{ rotulo: string; count: number; percent: number }>;
  anexos_presentes: number;
  anexos_ausentes: number;
  threshold_horas: number;
};

function oneDayAgo(): string {
  return new Date(Date.now() - 86_400_000).toISOString();
}

function thirtyDaysAgo(): string {
  return new Date(Date.now() - 30 * 86_400_000).toISOString();
}

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.max(0, Math.ceil(sorted.length * p) - 1);
  return sorted[idx] ?? sorted[sorted.length - 1] ?? null;
}

export async function getThresholdHoras(admin: SupabaseClient): Promise<number> {
  const { data } = await admin
    .from("configuracoes_dashboard")
    .select("config")
    .single();
  return (data?.config as { aprovacao_lenta_horas?: number } | null)?.aprovacao_lenta_horas ?? 24;
}

async function resolveAfastamentoItems(
  admin: SupabaseClient,
  ids: string[],
): Promise<FailedItem[]> {
  if (ids.length === 0) return [];
  const { data } = await admin
    .from("afastamentos")
    .select("id, colaborador_nome, afastamento_tipos(rotulo)")
    .in("id", ids.slice(0, 5)); // cap at 5 for inline list
  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    colaborador_nome: (row.colaborador_nome as string) ?? "—",
    tipo: (row.afastamento_tipos?.rotulo as string) ?? "—",
  }));
}

export async function getEmailsFalhados(admin: SupabaseClient): Promise<FailedGroup> {
  const { data } = await (admin
    .from("eventos")
    .select("entidade_id, dados")
    .eq("evento", "email_enviado")
    .eq("tipo_entidade", "afastamento")
    .gte("ocorrido_em", oneDayAgo()) as any);

  const failed = (data ?? []).filter(
    (e: any) => e.dados && typeof e.dados === "object" && "error" in e.dados,
  );
  const ids = [...new Set<string>(failed.map((e: any) => e.entidade_id as string))];
  const items = await resolveAfastamentoItems(admin, ids);
  return { count: ids.length, items };
}

export async function getFluigFalhados(admin: SupabaseClient): Promise<FailedGroup> {
  const { data } = await (admin
    .from("eventos")
    .select("entidade_id")
    .eq("evento", "fluig_erro")
    .eq("tipo_entidade", "afastamento")
    .gte("ocorrido_em", oneDayAgo()) as any);

  const ids = [...new Set<string>((data ?? []).map((e: any) => e.entidade_id as string))];
  const items = await resolveAfastamentoItems(admin, ids);
  return { count: ids.length, items };
}

export async function getAprovacaoLatencia(
  admin: SupabaseClient,
): Promise<{ p50_horas: number | null; p95_horas: number | null }> {
  const cutoff = thirtyDaysAgo();

  const { data: aprovados } = await (admin
    .from("eventos")
    .select("entidade_id, ocorrido_em")
    .eq("evento", "aprovado")
    .eq("tipo_entidade", "afastamento")
    .gte("ocorrido_em", cutoff) as any);

  if (!aprovados || aprovados.length === 0) return { p50_horas: null, p95_horas: null };

  const ids = aprovados.map((e: any) => e.entidade_id as string);

  const { data: criados } = await (admin
    .from("eventos")
    .select("entidade_id, ocorrido_em")
    .eq("evento", "criado")
    .eq("tipo_entidade", "afastamento")
    .in("entidade_id", ids) as any);

  const criadoMap = Object.fromEntries(
    (criados ?? []).map((e: any) => [e.entidade_id as string, e.ocorrido_em as string]),
  );

  const diffs = aprovados
    .filter((e: any) => criadoMap[e.entidade_id as string])
    .map((e: any) => {
      const aprovadoMs = new Date(e.ocorrido_em as string).getTime();
      const criadoMs = new Date(criadoMap[e.entidade_id as string]!).getTime();
      return (aprovadoMs - criadoMs) / 3_600_000;
    })
    .filter((h: number) => h >= 0)
    .sort((a: number, b: number) => a - b);

  return {
    p50_horas: percentile(diffs, 0.5),
    p95_horas: percentile(diffs, 0.95),
  };
}

export async function getOcorrenciasPorSituacao(
  admin: SupabaseClient,
): Promise<Array<{ situacao: string; count: number }>> {
  const { data } = await (admin
    .from("ocorrencias")
    .select("situacao") as any);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const s = row.situacao as string;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return Object.entries(counts).map(([situacao, count]) => ({ situacao, count }));
}

export async function getAfastosPorTipo(
  admin: SupabaseClient,
): Promise<Array<{ rotulo: string; count: number; percent: number }>> {
  const { data } = await (admin
    .from("afastamentos")
    .select("afastamento_tipos(rotulo)")
    .gte("criado_em", startOfMonth()) as any);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const rotulo = (row.afastamento_tipos?.rotulo as string) ?? "Sem tipo";
    counts[rotulo] = (counts[rotulo] ?? 0) + 1;
  }
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const topTotal = entries.reduce((s, [, n]) => s + n, 0);
  const result = entries.map(([rotulo, count]) => ({
    rotulo,
    count,
    percent: total === 0 ? 0 : Math.round((count / total) * 100),
  }));
  if (topTotal < total) {
    result.push({
      rotulo: `Outros`,
      count: total - topTotal,
      percent: Math.round(((total - topTotal) / total) * 100),
    });
  }
  return result;
}

export async function getAnexosStatus(
  admin: SupabaseClient,
): Promise<{ presentes: number; ausentes: number }> {
  const { data } = await (admin
    .from("afastamentos")
    .select("arquivo_url") as any);

  let presentes = 0;
  let ausentes = 0;
  for (const row of data ?? []) {
    if (row.arquivo_url) presentes++;
    else ausentes++;
  }
  return { presentes, ausentes };
}

