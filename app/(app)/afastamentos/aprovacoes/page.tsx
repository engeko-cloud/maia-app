import { requireEquipe } from "@/components/gates/equipe-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import { AprovacoesPanel } from "@/components/afastamentos/aprovacoes-panel";

export default async function AprovacoesPage() {
  await requireEquipe("oh");
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("afastamentos")
    .select("*, afastamento_tipos!inner(codigo, rotulo)")
    .eq("situacao", "pendente")
    .order("criado_em", { ascending: true });

  const pendentes = (data ?? []).map((a: any) => ({
    ...a,
    tipo_codigo: a.afastamento_tipos?.codigo,
  }));

  return <AprovacoesPanel pendentes={pendentes} />;
}
