import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { OcorrenciaForm } from "@/components/forms/ocorrencia-form";

export default async function OcorrenciaPublicForm() {
  const supabase = getSupabaseAdmin();
  const [{ data: empresas }, { data: unidades }] = await Promise.all([
    supabase.from("empresas").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  return <OcorrenciaForm lookups={{ empresas: empresas ?? [], unidades: unidades ?? [] }} />;
}
