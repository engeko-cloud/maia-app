import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeEvento } from "@/lib/eventos";
import { calcDataFim } from "@/lib/afastamento-date";

const EditSchema = z.object({
  tipo_id:     z.string().uuid(),
  unidade_id:  z.string().uuid().nullable(),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duracao:     z.number().int().positive(),
  cid:         z.string().nullable(),
  emissor:     z.object({
    tipo: z.string().min(1),
    no:   z.string().min(1),
    uf:   z.string().length(2),
  }).nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  // Verifica autenticação do usuário
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Verifica permissão: somente admin ou membro da equipe oh pode editar
  const { data: usuario } = await supabase.from("usuarios").select("administrador").eq("id", user.id).single();
  const { data: m } = await supabase.from("equipe_usuarios").select("equipes!inner(codigo)").eq("usuario_id", user.id);
  const isOh = (m ?? []).some((r: any) => r.equipes?.codigo === "oh");
  if (!usuario?.administrador && !isOh) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = EditSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }

  const { tipo_id, unidade_id, data_inicio, duracao, cid, emissor } = parsed.data;
  const data_fim = calcDataFim(data_inicio, duracao);

  // Use admin client for writes (bypasses RLS)
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("afastamentos")
    .update({ tipo_id, unidade_id: unidade_id ?? undefined, data_inicio, duracao, data_fim, cid: cid ?? undefined, emissor: emissor ?? undefined })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeEvento(admin, {
    tipoEntidade: "afastamento",
    entidadeId:   id,
    evento:       "editado",
    autorId:      user.id,
    dados:        { campos: Object.keys(parsed.data) },
  });

  return NextResponse.json({ ok: true });
}
