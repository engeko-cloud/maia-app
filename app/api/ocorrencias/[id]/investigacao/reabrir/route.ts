import { NextResponse, type NextRequest } from "next/server";
import { requireSafetyOrAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeEvento } from "@/lib/eventos";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSafetyOrAdmin();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = getSupabaseAdmin();

  const { data: inv, error: invErr } = await admin
    .from("investigacoes")
    .select("id, ocorrencia_id, situacao")
    .eq("ocorrencia_id", id)
    .single();
  if (invErr || !inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (inv.situacao !== "aprovada") {
    return NextResponse.json({ error: "invalid_transition", from: inv.situacao }, { status: 409 });
  }

  const { error: upErr } = await admin
    .from("investigacoes")
    .update({
      situacao:        "em_andamento",
      decidido_por:    null,
      decidido_em:     null,
      motivo_rejeicao: null,
      enviada_em:      null,
    })
    .eq("id", inv.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await admin.from("ocorrencias").update({ situacao: "em_investigacao" }).eq("id", inv.ocorrencia_id);
  await writeEvento(admin, { tipoEntidade: "investigacao", entidadeId: inv.id, evento: "criado", autorId: user.id, dados: { reabertura: true } });

  return NextResponse.json({ ok: true });
}
