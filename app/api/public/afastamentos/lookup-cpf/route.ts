import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { lookupColaboradorByCpf } from "@/lib/soc";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({ cpf: z.string().regex(/^\d{11}$/) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_cpf" }, { status: 400 });

  try {
    const soc = await lookupColaboradorByCpf(parsed.data.cpf);
    if (!soc) return NextResponse.json(null);

    const supabase = getSupabaseAdmin();
    const { data: empresa } = await supabase.from("empresas")
      .select("id").eq("codigo_soc", soc.codigo_empresa_soc).single();
    const { data: unidade } = await supabase.from("unidades")
      .select("id").eq("codigo", soc.codigo_unidade_soc).maybeSingle();

    return NextResponse.json({
      ...soc,
      empresa_id: empresa?.id ?? null,
      unidade_id: unidade?.id ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "soc_failed" }, { status: 502 });
  }
}
