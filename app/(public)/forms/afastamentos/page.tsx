import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AfastamentoForm } from "@/components/forms/afastamento-form";
import { PublicFormShell } from "@/components/forms/public-form-shell";

export default async function AfastamentoPublicForm() {
  const supabase = getSupabaseAdmin();
  const [{ data: empresas }, { data: unidades }, { data: tipos }] = await Promise.all([
    supabase.from("empresas").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("afastamento_tipos").select("id, codigo, rotulo").eq("ativo", true).order("ordem"),
  ]);

  return (
    <PublicFormShell
      title="Registrar afastamento"
      banner="Use este formulário para registrar afastamentos médicos, INSS, acidentes ou outras ausências. Você receberá um email com o status da solicitação."
    >
      <AfastamentoForm
        lookups={{ empresas: empresas ?? [], unidades: unidades ?? [], tipos: tipos ?? [] }}
      />
    </PublicFormShell>
  );
}
