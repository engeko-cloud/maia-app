import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AfastamentoInputSchema } from "@/lib/validation/afastamento";
import { writeEvento } from "@/lib/eventos";
import { isEditAllowed, canTransition } from "@/lib/afastamento-state";

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("afastamentos")
    .select(`*,
      empresas!inner(id, nome),
      unidades!inner(id, nome),
      afastamento_tipos!inner(id, codigo, rotulo, requer_aprovacao)`)
    .eq("token_edicao", token)
    .single();
  if (error || !data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json();
  if (body.hora_inicio === "") body.hora_inicio = undefined;
  if (body.hora_fim === "") body.hora_fim = undefined;
  // Empty/omitted CID defaults to "Z00" — see POST handler comment.
  if (!body.cid || typeof body.cid !== "string" || !body.cid.trim()) body.cid = "Z00";
  const parsed = AfastamentoInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: current } = await supabase.from("afastamentos")
    .select("id, situacao").eq("token_edicao", token).single();
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!isEditAllowed(current.situacao as any)) {
    return NextResponse.json({ error: "edit_not_allowed", situacao: current.situacao }, { status: 409 });
  }
  if (!canTransition(current.situacao as any, "pendente")) {
    return NextResponse.json({ error: "invalid_transition" }, { status: 409 });
  }

  // ocorrencia_id é vinculado pela tabela join — não é coluna do afastamento.
  const { ocorrencia_id: _ocorrenciaId, ...updateFields } = parsed.data;
  const { error: upErr } = await supabase.from("afastamentos")
    .update({ ...updateFields, situacao: "pendente", motivo_rejeicao: null })
    .eq("id", current.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await writeEvento(supabase, {
    tipoEntidade: "afastamento", entidadeId: current.id, evento: "resubmetido",
  });

  return NextResponse.json({ ok: true });
}
