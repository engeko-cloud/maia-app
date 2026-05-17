import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const CreateSchema = z.object({
  texto:  z.string().min(1),
  anexos: z.array(z.object({ path: z.string().min(1), nome: z.string().min(1) })),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: usuario }, { data: m }] = await Promise.all([
    supabase.from("usuarios").select("nome, administrador").eq("id", user.id).single(),
    supabase.from("equipe_usuarios").select("equipes!inner(codigo)").eq("usuario_id", user.id),
  ]);
  const isOh = (m ?? []).some((r: any) => r.equipes?.codigo === "oh");
  if (!usuario?.administrador && !isOh) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("afastamento_comentarios")
    .insert({
      afastamento_id: id,
      autor_id:       user.id,
      autor_nome:     usuario?.nome ?? "Usuário",
      texto:          parsed.data.texto,
      anexos:         parsed.data.anexos,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
