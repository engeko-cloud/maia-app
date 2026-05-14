import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: u } = await supabase.from("usuarios").select("administrador").eq("id", user.id).single();
  return u?.administrador ? user : null;
}

const Body = z.object({ usuario_id: z.string().uuid() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("equipe_usuarios")
    .insert({ equipe_id: id, usuario_id: parsed.data.usuario_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const usuario_id = new URL(req.url).searchParams.get("usuario_id");
  if (!usuario_id) return NextResponse.json({ error: "missing_usuario_id" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("equipe_usuarios").delete()
    .eq("equipe_id", id).eq("usuario_id", usuario_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
