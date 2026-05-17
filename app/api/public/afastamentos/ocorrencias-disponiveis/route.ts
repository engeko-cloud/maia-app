import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const Query = z.object({
  empresa_id: z.string().uuid(),
  cpf:        z.string().regex(/^\d{11}$/),
});

// Retorna ocorrências da mesma empresa+cpf que ainda não estão vinculadas a
// um afastamento. Usado pelo afastamento-form (codigo=acidente) para vincular.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = Query.safeParse({
    empresa_id: url.searchParams.get("empresa_id") ?? "",
    cpf:        url.searchParams.get("cpf") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_input" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: vinculadas } = await supabase
    .from("afastamento_ocorrencias")
    .select("ocorrencia_id");
  const excluidos = new Set((vinculadas ?? []).map((v) => v.ocorrencia_id));

  const { data: ocorrencias, error } = await supabase
    .from("ocorrencias")
    .select("id, tipo, data_ocorrencia, descricao")
    .eq("empresa_id", parsed.data.empresa_id)
    .eq("cpf", parsed.data.cpf)
    .order("data_ocorrencia", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filtradas = (ocorrencias ?? []).filter((o) => !excluidos.has(o.id));
  return NextResponse.json(filtradas);
}
