import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AfastamentoForm } from "@/components/forms/afastamento-form";
import { PublicFormShell } from "@/components/forms/public-form-shell";

export default async function EditarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: a } = await supabase
    .from("afastamentos")
    .select("*, empresas!inner(id, nome), unidades!inner(id, nome), afastamento_tipos!inner(id, codigo, rotulo)")
    .eq("token_edicao", token)
    .single();
  if (!a) notFound();

  if (a.situacao !== "rejeitado") {
    return (
      <PublicFormShell
        title="Link indisponível"
        banner="Este link só pode ser usado enquanto o registro estiver rejeitado."
      >
        <p className="text-sm text-[var(--color-fg-muted)]">
          Se você acredita que está vendo esta mensagem por engano, entre em contato com o RH.
        </p>
      </PublicFormShell>
    );
  }

  const [{ data: empresas }, { data: unidades }, { data: tipos }] = await Promise.all([
    supabase.from("empresas").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("afastamento_tipos").select("id, codigo, rotulo").eq("ativo", true).order("ordem"),
  ]);

  return (
    <PublicFormShell
      title="Corrigir afastamento"
      banner="Seu envio foi rejeitado. Corrija as informações abaixo e reenvie."
      callout={
        <div className="rounded-md border border-[var(--brand-accent-500)]/40 bg-[var(--color-accent-soft)] px-4 py-3 text-sm">
          <strong className="text-[var(--brand-accent-600)]">Motivo da rejeição:</strong>{" "}
          <span className="text-foreground">{a.motivo_rejeicao}</span>
        </div>
      }
    >
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
    </PublicFormShell>
  );
}
