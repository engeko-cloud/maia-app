import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: u } = await supabase.from("usuarios").select("administrador").eq("id", user.id).single();
  return u?.administrador ? user : null;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("equipes")
    .select("id, codigo, nome, ativo, equipe_usuarios(usuario_id, usuarios(id, nome, email))")
    .order("codigo");
  return NextResponse.json(data);
}
