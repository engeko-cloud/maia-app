import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function oneDayAgo() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

export async function GET() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();

  const { data: eventos, error } = await admin
    .from("eventos")
    .select("id, tipo_entidade, evento, ocorrido_em")
    .in("tipo_entidade", ["afastamento", "ocorrencia"])
    .gte("ocorrido_em", oneDayAgo())
    .order("ocorrido_em", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (eventos ?? []).map((e) => e.id);

  const { data: lidos } = ids.length
    ? await admin
        .from("eventos_lidos")
        .select("evento_id")
        .eq("usuario_id", user.id)
        .in("evento_id", ids)
    : { data: [] };

  const lidosSet = new Set((lidos ?? []).map((l) => l.evento_id));

  const items = (eventos ?? []).map((e) => ({
    id: e.id,
    tipo_entidade: e.tipo_entidade,
    evento: e.evento,
    ocorrido_em: e.ocorrido_em,
    lido: lidosSet.has(e.id),
  }));

  return NextResponse.json(items);
}
