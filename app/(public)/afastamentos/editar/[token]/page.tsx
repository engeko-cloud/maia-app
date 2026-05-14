import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AfastamentoForm } from "@/components/forms/afastamento-form";

export default async function EditarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: a } = await supabase
    .from("afastamentos")
    .select(`*,
      empresas!inner(id, nome),
      unidades!inner(id, nome),
      afastamento_tipos!inner(id, codigo, rotulo)`)
    .eq("token_edicao", token).single();
  if (!a) notFound();

  if (a.situacao !== "rejeitado") {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">Link indisponível</h1>
        <p className="text-muted-foreground mt-2">
          Este link só pode ser usado enquanto o registro estiver rejeitado.
        </p>
      </main>
    );
  }

  const [{ data: empresas }, { data: unidades }, { data: tipos }] = await Promise.all([
    supabase.from("empresas").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("afastamento_tipos").select("id, codigo, rotulo").eq("ativo", true).order("ordem"),
  ]);

  return (
    <main className="p-6">
      <div className="max-w-2xl mx-auto mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
        <strong>Motivo da rejeição:</strong> {a.motivo_rejeicao}
      </div>
      <AfastamentoForm
        lookups={{ empresas: empresas ?? [], unidades: unidades ?? [], tipos: tipos ?? [] }}
        initial={{
          empresa_id: a.empresa_id, unidade_id: a.unidade_id, tipo_id: a.tipo_id,
          cpf: a.cpf, colaborador_nome: a.colaborador_nome ?? "",
          colaborador_setor: a.colaborador_setor ?? undefined, colaborador_cargo: a.colaborador_cargo ?? undefined,
          colaborador_codigo_soc: a.colaborador_codigo_soc ?? undefined,
          data_inicio: a.data_inicio, data_fim: a.data_fim ?? undefined, duracao: a.duracao ?? undefined,
          cid: a.cid ?? undefined, email_remetente: a.email_remetente,
          arquivo_url: a.arquivo_url ?? undefined, token: token,
        }}
      />
    </main>
  );
}
