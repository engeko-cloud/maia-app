import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { fetchSocColaborador } from "@/lib/soc";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({
  empresa_id: z.string().uuid(),
  cpf: z.string().regex(/^\d{11}$/),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_input" }, { status: 400 });
  }
  const { empresa_id, cpf } = parsed.data;

  const supabase = getSupabaseAdmin();
  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, codigo_soc")
    .eq("id", empresa_id)
    .single();

  if (!empresa?.codigo_soc) {
    return NextResponse.json({ error: "empresa_sem_codigo_soc" }, { status: 400 });
  }

  let soc;
  try {
    soc = await fetchSocColaborador(empresa.codigo_soc, cpf);
  } catch (err) {
    const message = err instanceof Error ? err.message : "soc_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!soc) return NextResponse.json(null);

  let unidade_id: string | null = null;
  const unidadePrefix = (soc.unidade_nome ?? "").slice(0, 3).trim();
  if (unidadePrefix.length === 3) {
    const { data: unidade } = await supabase
      .from("unidades")
      .select("id")
      .eq("ativo", true)
      .ilike("codigo", `${unidadePrefix}%`)
      .limit(1)
      .maybeSingle();
    unidade_id = unidade?.id ?? null;
  }

  return NextResponse.json({
    cpf: soc.cpf,
    nome: soc.nome,
    setor: soc.setor ?? "",
    cargo: soc.cargo ?? "",
    codigo_soc: soc.codigo_soc ?? "",
    empresa_id,
    unidade_id,
  });
}
