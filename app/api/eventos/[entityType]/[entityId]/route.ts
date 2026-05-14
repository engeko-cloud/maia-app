import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ entityType: string; entityId: string }> }) {
  const { entityType, entityId } = await params;
  if (!["afastamento", "ocorrencia", "investigacao"].includes(entityType)) {
    return NextResponse.json({ error: "bad_type" }, { status: 400 });
  }
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase
    .from("eventos")
    .select(`*, usuarios:autor_id(nome)`)
    .eq("tipo_entidade", entityType).eq("entidade_id", entityId)
    .order("ocorrido_em", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
