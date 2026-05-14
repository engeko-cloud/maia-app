import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { OcorrenciaForm } from "@/components/forms/ocorrencia-form";
import { PublicFormShell } from "@/components/forms/public-form-shell";

export default async function OcorrenciaPublicForm() {
  const supabase = getSupabaseAdmin();
  const [{ data: empresas }, { data: unidades }] = await Promise.all([
    supabase.from("empresas").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  return (
    <PublicFormShell
      title="Registrar ocorrência"
      banner="Use este formulário para reportar quase-acidentes, acidentes, doenças ocupacionais ou outros eventos. A equipe de segurança será notificada."
    >
      <OcorrenciaForm lookups={{ empresas: empresas ?? [], unidades: unidades ?? [] }} />
    </PublicFormShell>
  );
}
