import type { SupabaseClient } from "@supabase/supabase-js";

// Some `fluig_enviado` events from before the edge-function patch carry a
// Fluig business-level error inside `dados.response` (e.g. login failure):
//   <result><item><item>ERROR</item><item>{message}</item></item></result>
// SQL-side we narrow with a coarse LIKE; JS-side we re-confirm with the
// precise regex before treating the row as a failure.
const FLUIG_BIZ_ERROR_REGEX =
  /<item>\s*<item>\s*ERROR\s*<\/item>\s*<item>([^<]*)<\/item>/;
const FLUIG_BIZ_ERROR_LIKE = "*<item>ERROR</item>*";

export type FluigEventVariant = "enviado" | "erro";

export type FluigEventRow = {
  evento_id: string;
  evento: "fluig_enviado" | "fluig_erro";
  ocorrido_em: string;
  retry: boolean;
  autor_nome: string | null;
  afastamento_id: string;
  afastamento_serial_id: number | null;
  colaborador_nome: string;
  tipo: string;
  /** Only present on fluig_erro events. */
  erro: { message: string | null; status: number | null; raw: unknown } | null;
  /** Only present on fluig_enviado events. */
  response: unknown;
  /**
   * Set on fluig_erro rows when a later fluig_enviado for the same afastamento
   * has already resolved this failure.
   */
  resolved_at: string | null;
};

export type FluigEventosFilters = {
  status: "all" | "enviado" | "erro" | "pending";
  q: string;
  from: string | null;
  to: string | null;
};

export type FluigEventosPage = {
  items: FluigEventRow[];
  page: number;
  page_size: number;
  total: number;
};

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

function extractRetry(dados: unknown): boolean {
  if (!dados || typeof dados !== "object") return false;
  return (dados as Record<string, unknown>).retry === true;
}

function extractResponse(dados: unknown): unknown {
  if (!dados || typeof dados !== "object") return null;
  return (dados as Record<string, unknown>).response ?? null;
}

function extractMisclassifiedMessage(dados: unknown): string | null {
  if (!dados || typeof dados !== "object") return null;
  const response = (dados as Record<string, unknown>).response;
  if (typeof response !== "string") return null;
  const m = response.match(FLUIG_BIZ_ERROR_REGEX);
  return m ? m[1].trim() : null;
}

function applyEventFilter<T>(q: T, status: FluigEventosFilters["status"]): T {
  const qx = q as unknown as {
    eq: (k: string, v: string) => T;
    in: (k: string, v: string[]) => T;
    or: (s: string) => T;
  };
  if (status === "enviado") {
    return (qx.eq("evento", "fluig_enviado") as unknown as {
      or: (s: string) => T;
    }).or(`dados->>response.is.null,dados->>response.not.ilike.${FLUIG_BIZ_ERROR_LIKE}`);
  }
  if (status === "erro" || status === "pending") {
    return qx.or(
      `evento.eq.fluig_erro,and(evento.eq.fluig_enviado,dados->>response.ilike.${FLUIG_BIZ_ERROR_LIKE})`,
    );
  }
  return qx.in("evento", ["fluig_enviado", "fluig_erro"]);
}

export async function getFluigEventos(
  admin: SupabaseClient,
  filters: FluigEventosFilters,
  page: number,
  pageSize: number,
): Promise<FluigEventosPage> {
  // <input type="date"> returns YYYY-MM-DD. Treat `to` as end-of-day so the
  // upper bound includes events that happened later on the chosen day.
  const fromTs = filters.from || null;
  const toTs =
    filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)
      ? `${filters.to}T23:59:59.999`
      : filters.to || null;

  // When searching, first resolve matching afastamento ids — PostgREST can
  // filter on embedded columns but does not narrow the parent row set.
  let matchingAfastamentoIds: string[] | null = null;
  if (filters.q) {
    const safe = filters.q.replace(/[%_,]/g, "");
    const { data: matched } = await (admin
      .from("afastamentos")
      .select("id")
      .ilike("colaborador_nome", `%${safe}%`)
      .limit(2000) as any);
    matchingAfastamentoIds = ((matched ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (matchingAfastamentoIds.length === 0) {
      return { items: [], page, page_size: pageSize, total: 0 };
    }
  }

  // Step 1: count matching events for pagination total
  let countQuery = (admin
    .from("eventos")
    .select("id", { count: "exact", head: true })
    .eq("tipo_entidade", "afastamento") as any);
  countQuery = applyEventFilter(countQuery, filters.status);
  if (fromTs) countQuery = countQuery.gte("ocorrido_em", fromTs);
  if (toTs) countQuery = countQuery.lte("ocorrido_em", toTs);
  if (matchingAfastamentoIds) countQuery = countQuery.in("entidade_id", matchingAfastamentoIds);
  const { count } = await countQuery;

  // Step 2: fetch the page joined with autor only — eventos.entidade_id has no
  // FK to afastamentos, so PostgREST can't infer that join. Afastamentos are
  // looked up in a second query and merged in JS.
  const offset = Math.max(0, (page - 1) * pageSize);
  let q = (admin
    .from("eventos")
    .select(
      `id, evento, ocorrido_em, dados, entidade_id,
       autor:usuarios!eventos_autor_id_fkey(nome, sobrenome)`,
    )
    .eq("tipo_entidade", "afastamento")
    .order("ocorrido_em", { ascending: false })
    .range(offset, offset + pageSize - 1) as any);
  q = applyEventFilter(q, filters.status);
  if (fromTs) q = q.gte("ocorrido_em", fromTs);
  if (toTs) q = q.lte("ocorrido_em", toTs);
  if (matchingAfastamentoIds) q = q.in("entidade_id", matchingAfastamentoIds);
  const { data } = await q;

  const rawRows = (data ?? []) as Array<{
    id: string;
    evento: "fluig_enviado" | "fluig_erro";
    ocorrido_em: string;
    dados: unknown;
    entidade_id: string;
    autor: { nome: string | null; sobrenome: string | null } | null;
  }>;

  // Lookup afastamentos for the events we just fetched.
  const afastamentoIds = [...new Set(rawRows.map((r) => r.entidade_id))];
  const afastamentoMap = new Map<
    string,
    { id: string; serial_id: number | null; colaborador_nome: string | null; tipo: string | null }
  >();
  if (afastamentoIds.length > 0) {
    const { data: afastamentos } = await (admin
      .from("afastamentos")
      .select("id, serial_id, colaborador_nome, afastamento_tipos!inner(rotulo)")
      .in("id", afastamentoIds) as any);
    for (const a of (afastamentos ?? []) as Array<any>) {
      afastamentoMap.set(a.id as string, {
        id: a.id as string,
        serial_id: (a.serial_id as number | null) ?? null,
        colaborador_nome: (a.colaborador_nome as string | null) ?? null,
        tipo: (a.afastamento_tipos?.rotulo as string | null) ?? null,
      });
    }
  }

  const rows = rawRows.map((r) => ({
    ...r,
    afastamento: afastamentoMap.get(r.entidade_id) ?? null,
  })) as Array<{
    id: string;
    evento: "fluig_enviado" | "fluig_erro";
    ocorrido_em: string;
    dados: unknown;
    entidade_id: string;
    autor: { nome: string | null; sobrenome: string | null } | null;
    afastamento: {
      id: string;
      serial_id: number | null;
      colaborador_nome: string | null;
      tipo: string | null;
    } | null;
  }>;

  // Step 3: for failure rows (real or misclassified), mark which were resolved
  // by a later REAL fluig_enviado for the same afastamento. A misclassified
  // success is NOT a resolution.
  const failureAfastamentoIds = [...new Set(
    rows
      .filter((r) => r.evento === "fluig_erro" || extractMisclassifiedMessage(r.dados) !== null)
      .map((r) => r.entidade_id),
  )];
  const latestSuccessByAfastamento = new Map<string, string>();
  if (failureAfastamentoIds.length > 0) {
    const { data: successes } = await (admin
      .from("eventos")
      .select("entidade_id, ocorrido_em, dados")
      .eq("evento", "fluig_enviado")
      .eq("tipo_entidade", "afastamento")
      .in("entidade_id", failureAfastamentoIds)
      .or(`dados->>response.is.null,dados->>response.not.ilike.${FLUIG_BIZ_ERROR_LIKE}`)
      .order("ocorrido_em", { ascending: false }) as any);
    for (const s of (successes ?? []) as Array<{
      entidade_id: string;
      ocorrido_em: string;
      dados: unknown;
    }>) {
      // Defensive: drop any straggler whose payload still matches the precise regex.
      if (extractMisclassifiedMessage(s.dados) !== null) continue;
      if (!latestSuccessByAfastamento.has(s.entidade_id)) {
        latestSuccessByAfastamento.set(s.entidade_id, s.ocorrido_em);
      }
    }
  }

  const items: FluigEventRow[] = rows.map((r) => {
    const autor =
      r.autor && (r.autor.nome || r.autor.sobrenome)
        ? `${r.autor.nome ?? ""} ${r.autor.sobrenome ?? ""}`.trim()
        : null;

    const misclassifiedMsg =
      r.evento === "fluig_enviado" ? extractMisclassifiedMessage(r.dados) : null;
    const effectiveEvento: "fluig_enviado" | "fluig_erro" =
      misclassifiedMsg !== null ? "fluig_erro" : r.evento;
    const isErrorRow = effectiveEvento === "fluig_erro";

    const latestSuccess = isErrorRow
      ? latestSuccessByAfastamento.get(r.entidade_id)
      : undefined;
    const resolvedAt =
      latestSuccess && new Date(latestSuccess).getTime() > new Date(r.ocorrido_em).getTime()
        ? latestSuccess
        : null;

    return {
      evento_id: r.id,
      evento: effectiveEvento,
      ocorrido_em: r.ocorrido_em,
      retry: extractRetry(r.dados),
      autor_nome: autor,
      afastamento_id: r.entidade_id,
      afastamento_serial_id: r.afastamento?.serial_id ?? null,
      colaborador_nome: r.afastamento?.colaborador_nome ?? "—",
      tipo: r.afastamento?.tipo ?? "—",
      erro: isErrorRow
        ? {
            message: misclassifiedMsg ?? extractErrorMessage(r.dados),
            status: misclassifiedMsg !== null ? null : extractErrorStatus(r.dados),
            raw: r.dados,
          }
        : null,
      response: !isErrorRow ? extractResponse(r.dados) : null,
      resolved_at: resolvedAt,
    };
  });

  // "Pending" = unresolved errors (no later success). Filter client-side
  // because resolution depends on the cross-event join above.
  const filtered =
    filters.status === "pending"
      ? items.filter((i) => i.evento === "fluig_erro" && !i.resolved_at)
      : items;

  return {
    items: filtered,
    page,
    page_size: pageSize,
    total: count ?? 0,
  };
}
