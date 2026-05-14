import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, nome, sobrenome, email, administrador, ativo")
    .eq("id", user.id)
    .single();

  if (!usuario) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: memberships } = await supabase
    .from("equipe_usuarios")
    .select("equipes(codigo)")
    .eq("usuario_id", user.id);

  const equipes = (memberships ?? []).flatMap((m: any) => m.equipes?.codigo ? [m.equipes.codigo] : []);

  return NextResponse.json({ ...usuario, equipes });
}
