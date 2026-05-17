import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { InvestigacaoDadosSchema } from "@/lib/investigacao-dados";

const Body = z.object({ dados: InvestigacaoDadosSchema });

const EDITABLE = new Set(["em_andamento", "rejeitada"]);

// Autosave: público via token. Preserva situacao (em_andamento ↔ em_andamento,
// rejeitada ↔ rejeitada). Recusa autosave em estados de leitura.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 422 });
  }

  const admin = getSupabaseAdmin();
  const { data: inv, error: lookupErr } = await admin
    .from("investigacoes")
    .select("id, ocorrencia_id, situacao")
    .eq("token_publico", token)
    .single();
  if (lookupErr || !inv) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!EDITABLE.has(inv.situacao)) {
    return NextResponse.json({ error: "not_editable", situacao: inv.situacao }, { status: 409 });
  }

  const { error: upErr } = await admin
    .from("investigacoes")
    .update({ dados: parsed.data.dados })
    .eq("id", inv.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Atualiza ocorrencia.situacao se a investigação ainda está em rascunho.
  if (inv.situacao === "em_andamento") {
    const d = parsed.data.dados;
    const nonEmpty =
      d.ishikawa.length + d.plano_acao.length + d.participantes.length + d.fotos.length > 0;
    await admin
      .from("ocorrencias")
      .update({ situacao: nonEmpty ? "em_investigacao" : "aberta" })
      .eq("id", inv.ocorrencia_id);
  }

  return NextResponse.json({ ok: true });
}
