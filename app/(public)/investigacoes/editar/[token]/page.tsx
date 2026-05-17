import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PublicFormShell } from "@/components/forms/public-form-shell";
import { PublicInvestigacaoForm } from "./form";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

const EMPTY: InvestigacaoDados = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] };

const SITUACAO_BANNERS: Record<string, string> = {
  em_andamento: "Preencha as etapas da investigação. Você pode salvar e voltar depois.",
  em_aprovacao: "Esta investigação foi enviada e aguarda aprovação da equipe de segurança.",
  aprovada:     "Esta investigação foi aprovada. O conteúdo agora é somente leitura.",
  cancelada:    "Esta investigação foi cancelada e não pode mais ser editada.",
  rejeitada:    "Sua investigação precisa de ajustes. Veja o motivo abaixo e atualize as etapas.",
};

export default async function PublicInvestigacaoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: inv } = await supabase
    .from("investigacoes")
    .select(`
      id, ocorrencia_id, situacao, dados, motivo_rejeicao,
      decidido_em, token_publico,
      ocorrencias!inner(
        id, serial_id, tipo, data_ocorrencia, descricao,
        colaborador_nome, cpf, token_edicao,
        empresas!inner(nome),
        unidades!inner(nome)
      )
    `)
    .eq("token_publico", token)
    .single();

  if (!inv) notFound();

  const [{ data: categorias }, { data: graus }, causasRes] = await Promise.all([
    supabase.from("investigacao_categorias").select("id, codigo, rotulo, ativo, ordem").order("ordem"),
    supabase.from("investigacao_graus").select("id, codigo, rotulo, ativo, ordem").order("ordem"),
    supabase.from("investigacao_causas").select("id, categoria_id, texto").eq("ativo", true).order("ordem"),
  ]);

  const causasByCategoria: Record<string, Array<{ id: string; texto: string }>> = {};
  for (const c of (causasRes.data ?? [])) {
    (causasByCategoria[c.categoria_id] ??= []).push({ id: c.id, texto: c.texto });
  }

  const dados = (inv.dados ?? EMPTY) as InvestigacaoDados;
  const o = inv.ocorrencias;

  return (
    <PublicFormShell
      title={`Investigação #${o.serial_id ?? "—"}`}
      banner={SITUACAO_BANNERS[inv.situacao] ?? ""}
      callout={
        inv.situacao === "rejeitada" && inv.motivo_rejeicao ? (
          <div className="rounded-md border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-4">
            <p className="text-sm font-semibold text-[var(--color-danger)]">Motivo da rejeição</p>
            <p className="mt-1 text-sm text-[var(--color-fg)] whitespace-pre-wrap">{inv.motivo_rejeicao}</p>
          </div>
        ) : null
      }
    >
      <PublicInvestigacaoForm
        token={inv.token_publico}
        situacao={inv.situacao}
        initialDados={dados}
        ocorrencia={{
          tipo:            o.tipo,
          data_ocorrencia: o.data_ocorrencia,
          empresa_nome:    o.empresas.nome,
          unidade_nome:    o.unidades.nome,
          colaborador_nome: o.colaborador_nome,
          token_edicao:    o.token_edicao,
        }}
        categorias={categorias ?? []}
        graus={graus ?? []}
        causasByCategoria={causasByCategoria}
      />
    </PublicFormShell>
  );
}
