import { NextResponse, type NextRequest } from "next/server";
import { requireSafetyOrAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertSubmittable } from "@/lib/investigacao-step-gates";
import { writeEvento } from "@/lib/eventos";
import { sendMail } from "@/lib/mail/send";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

const APPROVABLE = new Set(["em_andamento", "em_aprovacao", "rejeitada"]);

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSafetyOrAdmin();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = getSupabaseAdmin();

  const { data: inv, error: invErr } = await admin
    .from("investigacoes")
    .select(`
      id, ocorrencia_id, situacao, dados, token_publico,
      ocorrencias!inner(
        id, serial_id, tipo, data_ocorrencia, email_remetente,
        empresas!inner(nome),
        unidades!inner(nome)
      )
    `)
    .eq("ocorrencia_id", id)
    .single();
  if (invErr || !inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!APPROVABLE.has(inv.situacao)) {
    return NextResponse.json({ error: "invalid_transition", from: inv.situacao }, { status: 409 });
  }

  try {
    assertSubmittable(inv.dados as InvestigacaoDados);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "incompleto" }, { status: 422 });
  }

  const now = new Date().toISOString();
  const { error: upErr } = await admin
    .from("investigacoes")
    .update({
      situacao:        "aprovada",
      decidido_por:    user.id,
      decidido_em:     now,
      motivo_rejeicao: null,
    })
    .eq("id", inv.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await admin.from("ocorrencias").update({ situacao: "concluida" }).eq("id", inv.ocorrencia_id);
  await writeEvento(admin, { tipoEntidade: "investigacao", entidadeId: inv.id, evento: "aprovado", autorId: user.id });

  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "";
  if (inv.ocorrencias.email_remetente) {
    const { data: u } = await admin.from("usuarios").select("nome").eq("id", user.id).single();
    try {
      await sendMail({
        template: "investigacao-aprovada",
        to: inv.ocorrencias.email_remetente,
        data: { o: {
          serial_id:         inv.ocorrencias.serial_id,
          tipo:              inv.ocorrencias.tipo,
          data_ocorrencia:   inv.ocorrencias.data_ocorrencia,
          empresa_nome:      inv.ocorrencias.empresas.nome,
          unidade_nome:      inv.ocorrencias.unidades.nome,
          decidido_por_nome: u?.nome ?? null,
          decidido_em:       now,
          relatorio_url:     `${baseUrl}/ocorrencias/relatorio/${inv.token_publico}`,
        } },
      });
      await writeEvento(admin, {
        tipoEntidade: "investigacao", entidadeId: inv.id,
        evento: "email_enviado", autorId: user.id, dados: { template: "investigacao-aprovada" },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await writeEvento(admin, {
        tipoEntidade: "investigacao", entidadeId: inv.id,
        evento: "email_enviado", autorId: user.id, dados: { template: "investigacao-aprovada", error: msg },
      });
    }
  }

  return NextResponse.json({ ok: true, relatorio_url: `${baseUrl}/ocorrencias/relatorio/${inv.token_publico}` });
}
