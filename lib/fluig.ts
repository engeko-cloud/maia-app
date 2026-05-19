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

/** Envia os dados do afastamento para a edge function fluig-push via Supabase Functions. */
export async function pushToFluig(payload: FluigPushPayload) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.functions.invoke("fluig-push", { body: payload });
  if (error) throw new Error(error.message);
  return data;
}
