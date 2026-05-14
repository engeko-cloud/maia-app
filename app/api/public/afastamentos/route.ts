import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AfastamentoInputSchema } from "@/lib/validation/afastamento";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = AfastamentoInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;
  const supabase = getSupabaseAdmin();

  // Consulta o tipo de afastamento para definir a situação inicial.
  const { data: tipo, error: tipoErr } = await supabase
    .from("afastamento_tipos").select("requer_aprovacao").eq("id", input.tipo_id).single();
  if (tipoErr || !tipo) return NextResponse.json({ error: "bad_tipo" }, { status: 400 });

  const situacao = tipo.requer_aprovacao ? "pendente" : "finalizado";

  const { data, error } = await supabase
    .from("afastamentos")
    .insert({ ...input, situacao })
    .select("id, token_edicao")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("eventos").insert({
    tipo_entidade: "afastamento",
    entidade_id:   data.id,
    evento:        "criado",
    dados:         { situacao_inicial: situacao },
  });

  // Envio de e-mail adicionado em tarefa posterior.
  return NextResponse.json({ id: data.id, token_edicao: data.token_edicao });
}
