import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { OcorrenciaInputSchema } from "@/lib/validation/ocorrencia";
import { writeEvento } from "@/lib/eventos";
import { sendMail } from "@/lib/mail/send";
import OCORRENCIA_TIPOS from "@/lib/data/ocorrencia_tipos.json";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = OcorrenciaInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  if (!OCORRENCIA_TIPOS.includes(parsed.data.tipo)) {
    return NextResponse.json({ error: "invalid_tipo" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("ocorrencias").insert(parsed.data).select(`
    id,
    empresas!inner(nome),
    unidades!inner(nome)
  `).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeEvento(supabase, { tipoEntidade: "ocorrencia", entidadeId: data.id, evento: "criado" });

  try {
    await sendMail({
      template: "ocorrencia-receipt",
      to: parsed.data.email_remetente,
      data: { o: {
        tipo: parsed.data.tipo,
        data_ocorrencia: parsed.data.data_ocorrencia,
        empresa_nome: (data.empresas as any).nome,
        unidade_nome: (data.unidades as any).nome,
        descricao: parsed.data.descricao,
      } },
    });
    await writeEvento(supabase, { tipoEntidade: "ocorrencia", entidadeId: data.id,
      evento: "email_enviado", dados: { template: "ocorrencia-receipt", to: parsed.data.email_remetente } });
  } catch (err: any) {
    await writeEvento(supabase, { tipoEntidade: "ocorrencia", entidadeId: data.id,
      evento: "email_enviado", dados: { template: "ocorrencia-receipt", error: err.message } });
  }

  return NextResponse.json({ id: data.id });
}
