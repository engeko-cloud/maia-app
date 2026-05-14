import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeEvento } from "@/lib/eventos";

const Body = z.object({
  dados:    z.record(z.string(), z.any()),
  situacao: z.enum(["em_andamento", "finalizada", "arquivada"]).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const situacaoInvestigacao = parsed.data.situacao ?? "em_andamento";
  const { data, error } = await admin.from("investigacoes")
    .upsert(
      { ocorrencia_id: id, dados: parsed.data.dados, situacao: situacaoInvestigacao },
      { onConflict: "ocorrencia_id" },
    )
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ocorrenciaSituacao = situacaoInvestigacao === "finalizada" ? "concluida" : "em_investigacao";
  await admin.from("ocorrencias").update({ situacao: ocorrenciaSituacao }).eq("id", id);
  await writeEvento(admin, { tipoEntidade: "ocorrencia", entidadeId: id, evento: "criado", autorId: user.id, dados: { investigacao_id: data.id } });

  return NextResponse.json(data);
}
