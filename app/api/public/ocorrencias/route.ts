import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { OcorrenciaInputSchema } from "@/lib/validation/ocorrencia";
import { writeEvento } from "@/lib/eventos";
import { sendMail } from "@/lib/mail/send";
import { resolveSafetyRecipients, makeSupabaseRecipientSources } from "@/lib/safety-notify";
import OCORRENCIA_TIPOS from "@/lib/data/ocorrencia_tipos.json";

const EMPTY_DADOS = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] };

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = OcorrenciaInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  if (!OCORRENCIA_TIPOS.includes(parsed.data.tipo)) {
    return NextResponse.json({ error: "invalid_tipo" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("ocorrencias").insert(parsed.data).select(`
    id,
    empresas!inner(nome),
    unidades!inner(nome)
  `).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeEvento(supabase, { tipoEntidade: "ocorrencia", entidadeId: data.id, evento: "criado" });

  // Auto-create the empty investigacao so the form has a row to PATCH from day 0.
  // Best-effort: a failure here is unusual but should not fail the public submission.
  try {
    await supabase.from("investigacoes").insert({
      ocorrencia_id: data.id,
      dados: EMPTY_DADOS,
      situacao: "em_andamento",
    });
  } catch (err: unknown) {
    await writeEvento(supabase, {
      tipoEntidade: "ocorrencia", entidadeId: data.id, evento: "email_enviado",
      dados: { investigacao_autocreate_failed: String(err) },
    });
  }

  // Author receipt (existing behaviour)
  try {
    await sendMail({
      template: "ocorrencia-receipt",
      to: parsed.data.email_remetente,
      data: { o: {
        tipo: parsed.data.tipo,
        data_ocorrencia: parsed.data.data_ocorrencia,
        empresa_nome: (data.empresas as { nome: string }).nome,
        unidade_nome: (data.unidades as { nome: string }).nome,
        descricao: parsed.data.descricao,
      } },
    });
    await writeEvento(supabase, { tipoEntidade: "ocorrencia", entidadeId: data.id,
      evento: "email_enviado", dados: { template: "ocorrencia-receipt", to: parsed.data.email_remetente } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeEvento(supabase, { tipoEntidade: "ocorrencia", entidadeId: data.id,
      evento: "email_enviado", dados: { template: "ocorrencia-receipt", error: msg } });
  }

  // Safety-team notification (new)
  try {
    const sources = makeSupabaseRecipientSources(supabase);
    const recipients = await resolveSafetyRecipients(sources);
    if (recipients.length > 0) {
      await sendMail({
        template: "ocorrencia-nova-para-safety",
        to: recipients,
        data: { o: {
          ocorrencia_id:   data.id,
          tipo:            parsed.data.tipo,
          data_ocorrencia: parsed.data.data_ocorrencia,
          empresa_nome:    (data.empresas as { nome: string }).nome,
          unidade_nome:    (data.unidades as { nome: string }).nome,
          descricao:       parsed.data.descricao,
          base_url:        process.env.APP_URL ?? "",
        } },
      });
      await writeEvento(supabase, {
        tipoEntidade: "ocorrencia", entidadeId: data.id,
        evento: "ocorrencia_para_safety_enviada",
        dados: { destinatarios: recipients },
      });
    } else {
      await writeEvento(supabase, {
        tipoEntidade: "ocorrencia", entidadeId: data.id,
        evento: "ocorrencia_para_safety_falhou",
        dados: { destinatarios: [], error: "sem_destinatarios" },
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeEvento(supabase, {
      tipoEntidade: "ocorrencia", entidadeId: data.id,
      evento: "ocorrencia_para_safety_falhou",
      dados: { destinatarios: [], error: msg },
    });
  }

  return NextResponse.json({ id: data.id });
}
