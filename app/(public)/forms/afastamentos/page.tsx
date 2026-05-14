import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AfastamentoForm } from "@/components/forms/afastamento-form";

export default async function AfastamentoPublicForm() {
  const supabase = getSupabaseAdmin();
  const [{ data: empresas }, { data: unidades }, { data: tipos }] = await Promise.all([
    supabase.from("empresas").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("afastamento_tipos").select("id, codigo, rotulo").eq("ativo", true).order("ordem"),
  ]);

  return <AfastamentoForm lookups={{ empresas: empresas ?? [], unidades: unidades ?? [], tipos: tipos ?? [] }} />;
}
