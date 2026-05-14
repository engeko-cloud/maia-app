import type { SupabaseClient } from "@supabase/supabase-js";

export type EventoType =
  | "criado" | "rejeitado" | "resubmetido" | "aprovado"
  | "fluig_enviado" | "fluig_erro" | "email_enviado" | "cancelado";

export type WriteEventoInput = {
  tipoEntidade: "afastamento" | "ocorrencia" | "investigacao";
  entidadeId:   string;
  evento:       EventoType;
  dados?:       Record<string, unknown>;
  autorId?:     string | null;
};

export async function writeEvento(supabase: SupabaseClient, input: WriteEventoInput) {
  return supabase.from("eventos").insert({
    tipo_entidade: input.tipoEntidade,
    entidade_id:   input.entidadeId,
    evento:        input.evento,
    dados:         input.dados ?? {},
    autor_id:      input.autorId ?? null,
  }).select().single();
}
