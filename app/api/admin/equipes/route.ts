import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/admin-auth";

export async function GET() {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("equipes")
    .select("id, codigo, nome, ativo, equipe_usuarios(usuario_id, usuarios(id, nome, email))")
    .order("codigo");
  return NextResponse.json(data);
}
