import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AfastamentoInputSchema } from "@/lib/validation/afastamento";
import { writeEvento } from "@/lib/eventos";
import { sendMail } from "@/lib/mail/send";

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (body.hora_inicio === "") body.hora_inicio = undefined;
  if (body.hora_fim === "") body.hora_fim = undefined;
  const parsed = AfastamentoInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const { ocorrencia_id, ...input } = parsed.data;
  const supabase = getSupabaseAdmin();

  // Consulta o tipo de afastamento para definir a situação inicial.
  const { data: tipo, error: tipoErr } = await supabase
    .from("afastamento_tipos").select("requer_aprovacao").eq("id", input.tipo_id).single();
  if (tipoErr || !tipo) return NextResponse.json({ error: "bad_tipo" }, { status: 400 });

  const situacao = tipo.requer_aprovacao ? "pendente" : "finalizado";

  const { data, error } = await supabase
    .from("afastamentos")
    .insert({ ...input, situacao })
    .select("id, serial_id, token_edicao")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Vínculo opcional com ocorrência (1:1 via afastamento_ocorrencias).
  if (ocorrencia_id) {
    const { error: bindErr } = await supabase
      .from("afastamento_ocorrencias")
      .insert({ afastamento_id: data.id, ocorrencia_id });
    if (bindErr) {
      await writeEvento(supabase, {
        tipoEntidade: "afastamento", entidadeId: data.id,
        evento: "email_enviado",
        dados: { ocorrencia_bind_failed: bindErr.message, ocorrencia_id },
      });
    }
  }

  await writeEvento(supabase, {
    tipoEntidade: "afastamento",
    entidadeId:   data.id,
    evento:       "criado",
    dados:        { situacao_inicial: situacao },
  });

  // Carrega detalhes completos para o email
  const { data: full } = await supabase
    .from("afastamentos")
    .select(`*,
      empresas!inner(nome),
      unidades!inner(nome),
      afastamento_tipos!inner(rotulo)`)
    .eq("id", data.id).single();

  if (full) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "http://localhost:3000";
    const emailA = {
      serial_id:        full.serial_id,
      colaborador_nome: full.colaborador_nome,
      cpf:              full.cpf,
      tipo_rotulo:      (full.afastamento_tipos as any).rotulo,
      data_inicio:      full.data_inicio,
      data_fim:         full.data_fim,
      empresa_nome:     (full.empresas as any).nome,
      unidade_nome:     (full.unidades as any).nome,
      situacao:         full.situacao,
      cid:              full.cid,
      status_url:       `${baseUrl}/afastamentos/status/${data.token_edicao}`,
    };

    try {
      await sendMail({ template: "afastamento-receipt", to: input.email_remetente, data: { a: emailA } });
      await writeEvento(supabase, { tipoEntidade: "afastamento", entidadeId: data.id,
        evento: "email_enviado", dados: { template: "afastamento-receipt", to: input.email_remetente } });
    } catch (err: any) {
      await writeEvento(supabase, { tipoEntidade: "afastamento", entidadeId: data.id,
        evento: "email_enviado", dados: { template: "afastamento-receipt", error: err.message } });
    }

    if (situacao === "finalizado") {
      // Tipo não-médico: notifica folha automaticamente
      const { data: cfg } = await supabase.from("configuracoes").select("email_folha").eq("id", 1).single();
      if (cfg?.email_folha) {
        try {
          await sendMail({ template: "folha-auto-accept", to: cfg.email_folha, data: { a: emailA } });
          await writeEvento(supabase, { tipoEntidade: "afastamento", entidadeId: data.id,
            evento: "email_enviado", dados: { template: "folha-auto-accept", to: cfg.email_folha } });
        } catch (err: any) {
          await writeEvento(supabase, { tipoEntidade: "afastamento", entidadeId: data.id,
            evento: "email_enviado", dados: { template: "folha-auto-accept", error: err.message } });
        }
      }
    }
  }

  return NextResponse.json({ id: data.id, token_edicao: data.token_edicao });
}
