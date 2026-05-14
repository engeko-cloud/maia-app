import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  let q = supabase.from("afastamentos")
    .select(`id, cpf, colaborador_nome, data_inicio, data_fim, situacao, criado_em,
             empresas!inner(nome), unidades!inner(nome), afastamento_tipos!inner(codigo, rotulo)`)
    .order("criado_em", { ascending: false }).limit(200);

  if (sp.get("situacao")) q = q.eq("situacao", sp.get("situacao")!);
  if (sp.get("tipo"))     q = q.eq("tipo_id", sp.get("tipo")!);
  if (sp.get("empresa_id")) q = q.eq("empresa_id", sp.get("empresa_id")!);
  if (sp.get("unidade_id")) q = q.eq("unidade_id", sp.get("unidade_id")!);
  if (sp.get("cpf"))      q = q.eq("cpf", sp.get("cpf")!);
  if (sp.get("from"))     q = q.gte("data_inicio", sp.get("from")!);
  if (sp.get("to"))       q = q.lte("data_inicio", sp.get("to")!);
  if (sp.get("q"))        q = q.ilike("colaborador_nome", `%${sp.get("q")!}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
