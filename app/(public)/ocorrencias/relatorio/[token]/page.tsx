import { notFound, redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { InvestigacaoReport } from "@/components/investigacoes/investigacao-report";
import { PrintControls } from "./print-controls";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

const VIEWABLE = new Set(["em_aprovacao", "aprovada"]);

export default async function RelatorioPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: inv } = await supabase
    .from("investigacoes")
    .select(`
      id, situacao, dados, decidido_em, token_publico, decidido_por,
      ocorrencias!inner(
        serial_id, tipo, data_ocorrencia, descricao,
        colaborador_nome, cpf, colaborador_setor, colaborador_cargo,
        tipo_local, texto_local,
        atendimento, data_atendimento, hora_atendimento,
        duracao_afastamento, cid, parecer_medico,
        internacao, morte, bo, no_bo,
        empresas!inner(nome),
        unidades!inner(nome)
      )
    `)
    .eq("token_publico", token)
    .single();

  if (!inv) notFound();
  if (!VIEWABLE.has(inv.situacao)) {
    redirect(`/investigacoes/editar/${inv.token_publico}`);
  }

  const [{ data: categorias }, { data: graus }] = await Promise.all([
    supabase.from("investigacao_categorias").select("id, codigo, rotulo"),
    supabase.from("investigacao_graus").select("id, rotulo"),
  ]);

  const categoriasById: Record<string, { rotulo: string; codigo: string }> = {};
  for (const c of (categorias ?? [])) categoriasById[c.id] = { rotulo: c.rotulo, codigo: c.codigo };
  const grausById: Record<string, { rotulo: string }> = {};
  for (const g of (graus ?? [])) grausById[g.id] = { rotulo: g.rotulo };

  let decididoPorNome: string | null = null;
  if (inv.decidido_por) {
    const { data: u } = await supabase.from("usuarios").select("nome").eq("id", inv.decidido_por).single();
    decididoPorNome = u?.nome ?? null;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "";
  const o = inv.ocorrencias;

  return (
    <div className="min-h-screen bg-[var(--color-bg-muted)] py-6 print:bg-white print:py-0">
      <PrintControls tokenPublico={inv.token_publico} />
      <InvestigacaoReport
        ocorrencia={{
          serial_id:           o.serial_id,
          tipo:                o.tipo,
          data_ocorrencia:     o.data_ocorrencia,
          descricao:           o.descricao,
          colaborador_nome:    o.colaborador_nome,
          cpf:                 o.cpf,
          colaborador_setor:   o.colaborador_setor,
          colaborador_cargo:   o.colaborador_cargo,
          tipo_local:          o.tipo_local,
          texto_local:         o.texto_local,
          atendimento:         o.atendimento,
          data_atendimento:    o.data_atendimento,
          hora_atendimento:    o.hora_atendimento,
          duracao_afastamento: o.duracao_afastamento,
          cid:                 o.cid,
          parecer_medico:      o.parecer_medico,
          internacao:          o.internacao,
          morte:               o.morte,
          bo:                  o.bo,
          no_bo:               o.no_bo,
          empresa_nome:        o.empresas.nome,
          unidade_nome:        o.unidades.nome,
        }}
        investigacao={{
          situacao:           inv.situacao,
          dados:              (inv.dados ?? { ishikawa: [], plano_acao: [], participantes: [], fotos: [] }) as InvestigacaoDados,
          decidido_por_nome:  decididoPorNome,
          decidido_em:        inv.decidido_em,
          token_publico:      inv.token_publico,
        }}
        categoriasById={categoriasById}
        grausById={grausById}
        publicReportUrl={`${baseUrl}/ocorrencias/relatorio/${inv.token_publico}`}
        storagePublicBase="/api/public/investigacoes/preview?path="
      />
    </div>
  );
}
