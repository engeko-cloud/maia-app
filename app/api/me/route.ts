import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, nome, sobrenome, email, administrador, ativo, avatar_url, primeiro_acesso")
    .eq("id", user.id)
    .single();

  if (!usuario) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: memberships } = await supabase
    .from("equipe_usuarios")
    .select("equipes(codigo)")
    .eq("usuario_id", user.id);

  const equipes = (memberships ?? []).flatMap((m: any) => m.equipes?.codigo ? [m.equipes.codigo] : []);

  return NextResponse.json({ ...(usuario as any), equipes });
}

const PatchBody = z.object({
  nome:            z.string().min(2).optional(),
  sobrenome:       z.string().optional(),
  primeiro_acesso: z.literal(false).optional(),
});

export async function PATCH(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("usuarios")
    .update(parsed.data as any)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
