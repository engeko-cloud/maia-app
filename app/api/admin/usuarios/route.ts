import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/admin-auth";

export async function GET() {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("usuarios")
    .select("id, nome, sobrenome, email, administrador, ativo, criado_em")
    .order("criado_em", { ascending: false });
  return NextResponse.json(data);
}

const Body = z.object({
  email: z.string().email(),
  nome:  z.string().min(2),
  sobrenome: z.string().optional(),
  administrador: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const me = await requireAdminUser();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  const admin = getSupabaseAdmin();

  // Envia convite Supabase (cria auth.users e dispara email).
  const { data: invite, error: invErr } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_BASE_URL}/update-password`,
  });
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });

  const { error: insErr } = await admin.from("usuarios").insert({
    id: invite.user.id,
    email: parsed.data.email,
    nome: parsed.data.nome,
    sobrenome: parsed.data.sobrenome,
    administrador: parsed.data.administrador ?? false,
    criado_por: me.id,
  });

  // Se o insert falhar, remove o auth.user órfão.
  if (insErr) {
    await admin.auth.admin.deleteUser(invite.user.id).catch(() => {});
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: invite.user.id });
}
