import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type ColaboradorSOC = {
  cpf: string;
  nome: string;
  setor: string;
  cargo: string;
  codigo_soc: string;
  codigo_empresa_soc: string;
  codigo_unidade_soc: string;
};

export async function lookupColaboradorByCpf(cpf: string): Promise<ColaboradorSOC | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.functions.invoke<ColaboradorSOC | null>("soc-lookup", {
    body: { cpf },
  });
  if (error) throw new Error(error.message);
  return data ?? null;
}
