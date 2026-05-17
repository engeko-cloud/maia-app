import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSafetyOrAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeEvento } from "@/lib/eventos";
import { InvestigacaoDadosSchema } from "@/lib/investigacao-dados";

const Body = z.object({
  dados:    InvestigacaoDadosSchema,
  situacao: z.enum(["em_andamento"]).optional(),  // public/admin draft saves only
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSafetyOrAdmin();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });

  const admin = getSupabaseAdmin();

  // Determine target situacao. Admin save must preserve em_aprovacao (don't
  // drop the row out of the safety queue when the admin edits in place).
  // Otherwise default to em_andamento.
  const { data: existing } = await admin
    .from("investigacoes")
    .select("situacao")
    .eq("ocorrencia_id", id)
    .single();

  let targetSituacao: string;
  if (parsed.data.situacao) {
    targetSituacao = parsed.data.situacao;
  } else if (existing?.situacao === "em_aprovacao") {
    targetSituacao = "em_aprovacao";
  } else if (existing?.situacao === "rejeitada") {
    targetSituacao = "rejeitada";
  } else {
    targetSituacao = "em_andamento";
  }

  const { data: row, error } = await admin
    .from("investigacoes")
    .upsert(
      { ocorrencia_id: id, dados: parsed.data.dados, situacao: targetSituacao },
      { onConflict: "ocorrencia_id" },
    )
    .select()
    .single();
  if (error?.code === "23503") {
    return NextResponse.json({ error: "ocorrencia_removida" }, { status: 409 });
  }
  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? "unknown" }, { status: 500 });
  }

  // Parent ocorrência situacao
  const dadosNonEmpty =
    parsed.data.dados.ishikawa.length +
    parsed.data.dados.plano_acao.length +
    parsed.data.dados.participantes.length +
    parsed.data.dados.fotos.length > 0;

  const ocorrenciaSituacao =
    targetSituacao === "em_aprovacao" || targetSituacao === "rejeitada"
      ? "em_investigacao"
      : (dadosNonEmpty ? "em_investigacao" : "aberta");
  await admin.from("ocorrencias").update({ situacao: ocorrenciaSituacao }).eq("id", id);

  // Emit investigacao_iniciada idempotently: only if dados is non-empty AND no prior event.
  if (dadosNonEmpty) {
    const { count } = await admin
      .from("eventos")
      .select("id", { count: "exact", head: true })
      .eq("tipo_entidade", "investigacao")
      .eq("entidade_id", row.id)
      .eq("evento", "investigacao_iniciada");
    if ((count ?? 0) === 0) {
      await writeEvento(admin, {
        tipoEntidade: "investigacao", entidadeId: row.id,
        evento: "investigacao_iniciada", autorId: user.id,
      });
    }
  }

  return NextResponse.json(row);
}
