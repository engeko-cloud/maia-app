import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { InvestigacaoDadosSchema } from "@/lib/investigacao-dados";
import { assertSubmittable } from "@/lib/investigacao-step-gates";
import { writeEvento } from "@/lib/eventos";
import { sendMail } from "@/lib/mail/send";
import { resolveSafetyRecipients, makeSupabaseRecipientSources } from "@/lib/safety-notify";

const Body = z.object({ dados: InvestigacaoDadosSchema });

const SUBMITTABLE = new Set(["em_andamento", "rejeitada"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 422 });

  try {
    assertSubmittable(parsed.data.dados);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "incompleto" }, { status: 422 });
  }

  const admin = getSupabaseAdmin();
  const { data: inv, error: lookupErr } = await admin
    .from("investigacoes")
    .select(`
      id, ocorrencia_id, situacao,
      ocorrencias!inner(
        id, serial_id, tipo, data_ocorrencia,
        empresas!inner(nome),
        unidades!inner(nome)
      )
    `)
    .eq("token_publico", token)
    .single();
  if (lookupErr || !inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!SUBMITTABLE.has(inv.situacao)) {
    return NextResponse.json({ error: "invalid_transition", situacao: inv.situacao }, { status: 409 });
  }

  const { error: upErr } = await admin
    .from("investigacoes")
    .update({
      dados:       parsed.data.dados,
      situacao:    "em_aprovacao",
      enviada_em:  new Date().toISOString(),
      // Clear stale rejection bookkeeping on resubmit.
      motivo_rejeicao: null,
      decidido_por:    null,
      decidido_em:     null,
    })
    .eq("id", inv.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await admin.from("ocorrencias").update({ situacao: "em_investigacao" }).eq("id", inv.ocorrencia_id);

  await writeEvento(admin, {
    tipoEntidade: "investigacao", entidadeId: inv.id, evento: "investigacao_iniciada",
  });

  // Email safety team.
  try {
    const sources = makeSupabaseRecipientSources(admin);
    const recipients = await resolveSafetyRecipients(sources);
    if (recipients.length > 0) {
      const d = parsed.data.dados;
      const causasCount = d.ishikawa.reduce((acc, b) => acc + b.causas.length, 0);
      await sendMail({
        template: "investigacao-em-aprovacao",
        to: recipients,
        data: { o: {
          serial_id:           inv.ocorrencias.serial_id,
          ocorrencia_id:       inv.ocorrencia_id,
          tipo:                inv.ocorrencias.tipo,
          data_ocorrencia:     inv.ocorrencias.data_ocorrencia,
          empresa_nome:        inv.ocorrencias.empresas.nome,
          unidade_nome:        inv.ocorrencias.unidades.nome,
          causas_count:        causasCount,
          acoes_count:         d.plano_acao.length,
          participantes_count: d.participantes.length,
          fotos_count:         d.fotos.length,
          base_url:            process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "",
        } },
      });
      await writeEvento(admin, {
        tipoEntidade: "investigacao", entidadeId: inv.id,
        evento: "email_enviado", dados: { template: "investigacao-em-aprovacao", to: recipients },
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeEvento(admin, {
      tipoEntidade: "investigacao", entidadeId: inv.id,
      evento: "email_enviado", dados: { template: "investigacao-em-aprovacao", error: msg },
    });
  }

  return NextResponse.json({ ok: true });
}
