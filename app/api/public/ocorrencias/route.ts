import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { OcorrenciaInputSchema, type OcorrenciaInput } from "@/lib/validation/ocorrencia";
import { writeEvento } from "@/lib/eventos";
import { sendMail } from "@/lib/mail/send";
import { resolveSafetyRecipients, makeSupabaseRecipientSources } from "@/lib/safety-notify";
import { calcDataFim } from "@/lib/afastamento-tipo-rules";
import OCORRENCIA_TIPOS from "@/lib/data/ocorrencia_tipos.json";

const EMPTY_DADOS = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] };

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

// Mapeia tipo da ocorrência + duração para código do afastamento.
// Acidente/trajeto ⇒ acidente (≤15) ou prev_91 (>15).
// Doença/incidente ⇒ doenca (≤15) ou prev_31 (>15).
function inferAfastamentoCodigo(ocorrenciaTipo: string, duracao: number): string | null {
  const acidentario = ocorrenciaTipo === "acidente" || ocorrenciaTipo === "trajeto";
  const medico = ocorrenciaTipo === "doenca" || ocorrenciaTipo === "incidente";
  if (acidentario) return duracao > 15 ? "prev_91" : "acidente";
  if (medico)     return duracao > 15 ? "prev_31" : "doenca";
  return null;
}

// Cria afastamento médico vinculado quando a ocorrência tem atendimento +
// afastamento marcado. Falhas aqui não bloqueiam a submissão da ocorrência.
async function createBoundAfastamento(
  supabase: SupabaseAdmin,
  ocorrenciaId: string,
  o: OcorrenciaInput,
  arquivoUrl: string | undefined,
): Promise<{ id: string; serial_id: number | null; token_edicao: string; codigo: string; situacao: string } | null> {
  if (!o.atendimento || !o.afastamento) return null;
  const duracao = o.duracao_afastamento;
  if (!duracao || duracao < 1) return null;

  const codigo = inferAfastamentoCodigo(o.tipo, duracao);
  if (!codigo) return null;

  const { data: tipo } = await supabase
    .from("afastamento_tipos")
    .select("id, requer_aprovacao")
    .eq("codigo", codigo)
    .single();
  if (!tipo) return null;

  const dataInicio = (o.data_atendimento ?? o.data_ocorrencia).slice(0, 10);
  const dataFim = calcDataFim(dataInicio, duracao);
  const acidente = o.tipo === "acidente" || o.tipo === "trajeto";
  const situacao = tipo.requer_aprovacao ? "pendente" : "finalizado";

  const afPayload = {
    empresa_id:             o.empresa_id,
    unidade_id:             o.unidade_id,
    tipo_id:                tipo.id,
    cpf:                    o.cpf ?? "",
    colaborador_nome:       o.colaborador_nome,
    colaborador_setor:      o.colaborador_setor,
    colaborador_cargo:      o.colaborador_cargo,
    colaborador_codigo_soc: o.colaborador_codigo_soc,
    data_inicio:            dataInicio,
    data_fim:               dataFim,
    duracao,
    cid:                    o.cid,
    emissor:                o.emissor,
    inss:                   codigo === "prev_31" || codigo === "prev_91",
    acidente,
    internacao:             o.internacao ?? false,
    email_remetente:        o.email_remetente,
    arquivo_url:            arquivoUrl,
    situacao,
  };

  const { data: af, error: afErr } = await supabase
    .from("afastamentos")
    .insert(afPayload)
    .select("id, serial_id, token_edicao")
    .single();
  if (afErr || !af) return null;

  await supabase
    .from("afastamento_ocorrencias")
    .insert({ afastamento_id: af.id, ocorrencia_id: ocorrenciaId });

  return { id: af.id, serial_id: af.serial_id, token_edicao: af.token_edicao, codigo, situacao };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Empty/omitted CID defaults to "Z00" (ICD-10 generic). The bound afastamento
  // copies this cid downstream, and Fluig rejects empty motivoAfastamento/campoChave.
  if (!body.cid || typeof body.cid !== "string" || !body.cid.trim()) body.cid = "Z00";
  const parsed = OcorrenciaInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  if (!OCORRENCIA_TIPOS.includes(parsed.data.tipo)) {
    return NextResponse.json({ error: "invalid_tipo" }, { status: 400 });
  }

  // O anexo NUNCA é da ocorrência — sempre vira atestado do afastamento médico
  // vinculado (quando aplicável). Documentos da ocorrência entram via investigação.
  const { arquivo_url, ...ocorrenciaFields } = parsed.data;
  const insertData = {
    ...ocorrenciaFields,
    cpf: parsed.data.cpf ? parsed.data.cpf : undefined,
  };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ocorrencias")
    .insert(insertData)
    .select(`
      id,
      serial_id,
      token_edicao,
      empresas!inner(nome),
      unidades!inner(nome)
    `)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ocorrenciaRow = data;
  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "http://localhost:3000";

  await writeEvento(supabase, { tipoEntidade: "ocorrencia", entidadeId: ocorrenciaRow.id, evento: "criado" });

  // Cria investigação vazia para o PATCH funcionar desde o dia 0 e captura
  // token_publico para incluir no email de recibo.
  let investigacaoUrl: string | undefined;
  try {
    const { data: invRow, error: invErr } = await supabase
      .from("investigacoes")
      .insert({ ocorrencia_id: ocorrenciaRow.id, dados: EMPTY_DADOS, situacao: "em_andamento" })
      .select("token_publico")
      .single();
    if (invErr) throw invErr;
    investigacaoUrl = `${baseUrl}/investigacoes/editar/${invRow.token_publico}`;
  } catch (err: unknown) {
    await writeEvento(supabase, {
      tipoEntidade: "ocorrencia", entidadeId: ocorrenciaRow.id, evento: "email_enviado",
      dados: { investigacao_autocreate_failed: String(err) },
    });
  }

  // Cria afastamento médico vinculado (best-effort).
  let afastamentoCriado: Awaited<ReturnType<typeof createBoundAfastamento>> = null;
  try {
    afastamentoCriado = await createBoundAfastamento(supabase, ocorrenciaRow.id, parsed.data, arquivo_url);
    if (afastamentoCriado) {
      await writeEvento(supabase, {
        tipoEntidade: "afastamento",
        entidadeId:   afastamentoCriado.id,
        evento:       "criado",
        dados:        { origem: "ocorrencia", ocorrencia_id: ocorrenciaRow.id, codigo: afastamentoCriado.codigo },
      });
    }
  } catch (err: unknown) {
    await writeEvento(supabase, {
      tipoEntidade: "ocorrencia", entidadeId: ocorrenciaRow.id, evento: "email_enviado",
      dados: { afastamento_autocreate_failed: String(err) },
    });
  }

  // Recibo da ocorrência (autor).
  try {
    await sendMail({
      template: "ocorrencia-receipt",
      to: parsed.data.email_remetente,
      data: { o: {
        serial_id: ocorrenciaRow.serial_id,
        tipo: parsed.data.tipo,
        data_ocorrencia: parsed.data.data_ocorrencia,
        empresa_nome: ocorrenciaRow.empresas.nome,
        unidade_nome: ocorrenciaRow.unidades.nome,
        descricao: parsed.data.descricao ?? "",
        status_url: `${baseUrl}/ocorrencias/status/${ocorrenciaRow.token_edicao}`,
        investigacao_url: investigacaoUrl,
      } },
    });
    await writeEvento(supabase, { tipoEntidade: "ocorrencia", entidadeId: ocorrenciaRow.id,
      evento: "email_enviado", dados: { template: "ocorrencia-receipt", to: parsed.data.email_remetente } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeEvento(supabase, { tipoEntidade: "ocorrencia", entidadeId: ocorrenciaRow.id,
      evento: "email_enviado", dados: { template: "ocorrencia-receipt", error: msg } });
  }

  // Recibo do afastamento vinculado (autor). Segundo email — propósito é
  // separar tracking: cada registro tem seu próprio serial_id e status_url.
  if (afastamentoCriado) {
    try {
      await sendMail({
        template: "afastamento-receipt",
        to: parsed.data.email_remetente,
        data: { a: {
          serial_id:        afastamentoCriado.serial_id,
          colaborador_nome: parsed.data.colaborador_nome ?? "",
          cpf:              parsed.data.cpf ?? "",
          tipo_rotulo:      afastamentoCriado.codigo,
          data_inicio:      (parsed.data.data_atendimento ?? parsed.data.data_ocorrencia).slice(0, 10),
          data_fim:         null,
          empresa_nome:     ocorrenciaRow.empresas.nome,
          unidade_nome:     ocorrenciaRow.unidades.nome,
          situacao:         afastamentoCriado.situacao,
          cid:              parsed.data.cid,
          status_url:       `${baseUrl}/afastamentos/status/${afastamentoCriado.token_edicao}`,
        } },
      });
      await writeEvento(supabase, {
        tipoEntidade: "afastamento", entidadeId: afastamentoCriado.id,
        evento: "email_enviado", dados: { template: "afastamento-receipt", to: parsed.data.email_remetente },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await writeEvento(supabase, {
        tipoEntidade: "afastamento", entidadeId: afastamentoCriado.id,
        evento: "email_enviado", dados: { template: "afastamento-receipt", error: msg },
      });
    }
  }

  // Notifica equipe de segurança.
  try {
    const sources = makeSupabaseRecipientSources(supabase);
    const recipients = await resolveSafetyRecipients(sources);
    if (recipients.length > 0) {
      await sendMail({
        template: "ocorrencia-nova-para-safety",
        to: recipients,
        data: { o: {
          ocorrencia_id:   ocorrenciaRow.id,
          serial_id:       ocorrenciaRow.serial_id,
          tipo:            parsed.data.tipo,
          data_ocorrencia: parsed.data.data_ocorrencia,
          empresa_nome:    ocorrenciaRow.empresas.nome,
          unidade_nome:    ocorrenciaRow.unidades.nome,
          descricao:       parsed.data.descricao ?? "",
          base_url:        baseUrl,
        } },
      });
      await writeEvento(supabase, {
        tipoEntidade: "ocorrencia", entidadeId: ocorrenciaRow.id,
        evento: "ocorrencia_para_safety_enviada",
        dados: { destinatarios: recipients },
      });
    } else {
      await writeEvento(supabase, {
        tipoEntidade: "ocorrencia", entidadeId: ocorrenciaRow.id,
        evento: "ocorrencia_para_safety_falhou",
        dados: { destinatarios: [], error: "sem_destinatarios" },
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeEvento(supabase, {
      tipoEntidade: "ocorrencia", entidadeId: ocorrenciaRow.id,
      evento: "ocorrencia_para_safety_falhou",
      dados: { destinatarios: [], error: msg },
    });
  }

  return NextResponse.json({
    id: ocorrenciaRow.id,
    afastamento_id: afastamentoCriado?.id ?? null,
  });
}
