import type { SupabaseClient } from "@supabase/supabase-js";

export type FailedItem = {
  id: string;
  colaborador_nome: string;
  tipo: string;
  serial_id?: number | null;
  ultimo_erro?: string | null;
  ultimo_erro_status?: number | null;
  ultimo_erro_raw?: unknown;
  ocorrido_em?: string | null;
  tentativas?: number;
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
    .select("id, serial_id, colaborador_nome, afastamento_tipos(rotulo)")
    .in("id", ids.slice(0, 5)); // cap at 5 for inline list
  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    serial_id: (row.serial_id as number | null) ?? null,
    colaborador_nome: (row.colaborador_nome as string) ?? "—",
    tipo: (row.afastamento_tipos?.rotulo as string) ?? "—",
  }));
}

function extractErrorMessage(dados: unknown): string | null {
  if (!dados || typeof dados !== "object") return null;
  const d = dados as Record<string, unknown>;
  if (typeof d.error === "string") return d.error;
  if (d.error && typeof d.error === "object") {
    const inner = (d.error as Record<string, unknown>).message;
    if (typeof inner === "string") return inner;
  }
  if (typeof d.message === "string") return d.message;
  return null;
}

function extractErrorStatus(dados: unknown): number | null {
  if (!dados || typeof dados !== "object") return null;
  const err = (dados as Record<string, unknown>).error;
  if (err && typeof err === "object") {
    const s = (err as Record<string, unknown>).status;
    if (typeof s === "number") return s;
  }
  return null;
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
    .select("entidade_id, dados, ocorrido_em")
    .eq("evento", "fluig_erro")
    .eq("tipo_entidade", "afastamento")
    .gte("ocorrido_em", oneDayAgo())
    .order("ocorrido_em", { ascending: false }) as any);

  const events = (data ?? []) as Array<{ entidade_id: string; dados: unknown; ocorrido_em: string }>;
  // Group by afastamento: latest error + retry count
  type Meta = {
    ultimo_erro: string | null;
    ultimo_erro_status: number | null;
    ultimo_erro_raw: unknown;
    ocorrido_em: string;
    tentativas: number;
  };
  const byId = new Map<string, Meta>();
  for (const ev of events) {
    const prev = byId.get(ev.entidade_id);
    if (!prev) {
      byId.set(ev.entidade_id, {
        ultimo_erro: extractErrorMessage(ev.dados),
        ultimo_erro_status: extractErrorStatus(ev.dados),
        ultimo_erro_raw: ev.dados,
        ocorrido_em: ev.ocorrido_em,
        tentativas: 1,
      });
    } else {
      prev.tentativas += 1;
    }
  }
  const ids = [...byId.keys()];
  const items = await resolveAfastamentoItems(admin, ids);
  // Merge error metadata into items
  const enriched = items.map((it) => {
    const meta = byId.get(it.id);
    return meta ? { ...it, ...meta } : it;
  });
  return { count: ids.length, items: enriched };
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

