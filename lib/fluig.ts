import { FunctionsHttpError } from "@supabase/functions-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Payload enviado para a edge function fluig-push. */
export type FluigPushPayload = {
  afastamento_id: string;
  tipo_codigo: string;
  cpf: string;
  colaborador_nome: string;
  colaborador_codigo_soc: string | null;
  empresa_codigo_fluig: string;
  data_inicio: string;
  data_fim: string | null;
  duracao: number | null;
  cid: string | null;
  cid_descricao: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  emissor: { tipo: string; nome: string; numero: string; uf: string } | null;
  unidade_nome: string;
  arquivo_url: string | null;
};

export type FluigPushResult = {
  ok: boolean;
  skipped?: boolean;
  response?: unknown;
  /** Present on failure. `message` is human-readable; `body` is the raw edge
   *  response so dashboards can render the full diagnostic; `status` is the
   *  HTTP status (when applicable). */
  error?: { message: string; body?: unknown; status?: number };
};

/** Tries to derive a human-readable message from an edge response body. */
function deriveMessage(body: unknown, fallback: string): string {
  if (typeof body === "string" && body.trim()) return body;
  if (body && typeof body === "object") {
    const d = body as Record<string, unknown>;
    if (typeof d.error === "string") return d.error;
    if (typeof d.message === "string") return d.message;
    if (typeof d.msg === "string") return d.msg;
  }
  return fallback;
}

/** Envia os dados do afastamento para a edge function fluig-push. Never throws
 *  on edge-function failures; instead returns `{ ok: false, error }` with the
 *  raw response body so callers can log the real underlying cause (e.g.
 *  "Missing env: FLUIG_BASE_URL"). Throws only on truly exceptional failures
 *  (network, malformed SDK responses). */
export async function pushToFluig(payload: FluigPushPayload): Promise<FluigPushResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.functions.invoke("fluig-push", { body: payload });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const resp = error.context as Response;
      const status = resp?.status;
      let body: unknown = null;
      try {
        const ct = resp.headers.get("content-type") ?? "";
        body = ct.includes("application/json") ? await resp.json() : await resp.text();
      } catch {
        // Body unreadable; fall through with status only.
      }
      const message = deriveMessage(body, `Edge function fluig-push retornou HTTP ${status ?? "?"}`);
      return { ok: false, error: { message, body, status } };
    }
    // FunctionsRelayError / FunctionsFetchError — these expose .message normally.
    return { ok: false, error: { message: error.message ?? String(error) } };
  }

  // Edge function returned 2xx. It may still have set ok=false in the body
  // (application-level error). Pass through unchanged.
  return (data as FluigPushResult) ?? { ok: true };
}
