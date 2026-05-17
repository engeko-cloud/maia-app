import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSafetyOrAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeEvento } from "@/lib/eventos";
import { sendMail } from "@/lib/mail/send";

const Body = z.object({ motivo_rejeicao: z.string().min(10) });

const REJECTABLE = new Set(["em_aprovacao", "rejeitada"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSafetyOrAdmin();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_motivo" }, { status: 400 });

  const { id } = await params;
  const admin = getSupabaseAdmin();

  const { data: inv, error: invErr } = await admin
    .from("investigacoes")
    .select(`
      id, ocorrencia_id, situacao, token_publico,
      ocorrencias!inner(
        serial_id, tipo, data_ocorrencia, email_remetente,
        empresas!inner(nome),
        unidades!inner(nome)
      )
    `)
    .eq("ocorrencia_id", id)
    .single();
  if (invErr || !inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!REJECTABLE.has(inv.situacao)) {
    return NextResponse.json({ error: "invalid_transition", from: inv.situacao }, { status: 409 });
  }

  const { error: upErr } = await admin
    .from("investigacoes")
    .update({
      situacao:        "rejeitada",
      decidido_por:    user.id,
      decidido_em:     new Date().toISOString(),
      motivo_rejeicao: parsed.data.motivo_rejeicao,
    })
    .eq("id", inv.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await admin.from("ocorrencias").update({ situacao: "em_investigacao" }).eq("id", inv.ocorrencia_id);
  await writeEvento(admin, {
    tipoEntidade: "investigacao", entidadeId: inv.id, evento: "rejeitado",
    autorId: user.id, dados: { motivo: parsed.data.motivo_rejeicao },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "";
  if (inv.ocorrencias.email_remetente) {
    try {
      await sendMail({
        template: "investigacao-rejeitada",
        to: inv.ocorrencias.email_remetente,
        data: { o: {
          serial_id:        inv.ocorrencias.serial_id,
          tipo:             inv.ocorrencias.tipo,
          data_ocorrencia:  inv.ocorrencias.data_ocorrencia,
          empresa_nome:     inv.ocorrencias.empresas.nome,
          unidade_nome:     inv.ocorrencias.unidades.nome,
          motivo:           parsed.data.motivo_rejeicao,
          edit_url:         `${baseUrl}/investigacoes/editar/${inv.token_publico}`,
        } },
      });
      await writeEvento(admin, {
        tipoEntidade: "investigacao", entidadeId: inv.id,
        evento: "email_enviado", autorId: user.id, dados: { template: "investigacao-rejeitada" },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await writeEvento(admin, {
        tipoEntidade: "investigacao", entidadeId: inv.id,
        evento: "email_enviado", autorId: user.id, dados: { template: "investigacao-rejeitada", error: msg },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
