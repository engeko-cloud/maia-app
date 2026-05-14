import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await supabase.from("ocorrencias")
    .select(`*, empresas!inner(nome), unidades!inner(nome)`)
    .order("criado_em", { ascending: false }).limit(200);
  return NextResponse.json(data);
}
