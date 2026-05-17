import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const EditSchema = z.object({
  texto:  z.string().min(1),
  anexos: z.array(z.object({ path: z.string().min(1), nome: z.string().min(1) })),
});

async function resolveAuth(supabase: Awaited<ReturnType<typeof getSupabaseServer>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: usuario }, { data: m }] = await Promise.all([
    supabase.from("usuarios").select("administrador").eq("id", user.id).single(),
    supabase.from("equipe_usuarios").select("equipes!inner(codigo)").eq("usuario_id", user.id),
  ]);
  const isAdmin = usuario?.administrador === true;
  const isOh = (m ?? []).some((r: any) => r.equipes?.codigo === "oh");
  return { user, isAdmin, isOh };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; comentarioId: string }> },
) {
  const { id, comentarioId } = await params;
  const supabase = await getSupabaseServer();
  const auth = await resolveAuth(supabase);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.isAdmin && !auth.isOh) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = EditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Fetch to verify ownership
  const { data: comentario } = await (admin as any)
    .from("afastamento_comentarios")
    .select("autor_id")
    .eq("id", comentarioId)
    .eq("afastamento_id", id)
    .single();

  if (!comentario) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!auth.isAdmin && comentario.autor_id !== auth.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await (admin as any)
    .from("afastamento_comentarios")
    .update({
      texto:      parsed.data.texto,
      anexos:     parsed.data.anexos,
      editado_em: new Date().toISOString(),
    })
    .eq("id", comentarioId)
    .eq("afastamento_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; comentarioId: string }> },
) {
  const { id, comentarioId } = await params;
  const supabase = await getSupabaseServer();
  const auth = await resolveAuth(supabase);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.isAdmin && !auth.isOh) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = getSupabaseAdmin();

  const { data: comentario } = await (admin as any)
    .from("afastamento_comentarios")
    .select("autor_id")
    .eq("id", comentarioId)
    .eq("afastamento_id", id)
    .single();

  if (!comentario) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!auth.isAdmin && comentario.autor_id !== auth.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await (admin as any)
    .from("afastamento_comentarios")
    .delete()
    .eq("id", comentarioId)
    .eq("afastamento_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // TODO: delete orphaned storage files under afastamentos/comentarios/{id}/ when cleaning up attachments
  return NextResponse.json({ ok: true });
}
