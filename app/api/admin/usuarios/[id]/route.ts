import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/admin-auth";

const Patch = z.object({
  nome: z.string().optional(),
  sobrenome: z.string().optional(),
  administrador: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("usuarios").update(parsed.data).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const admin = getSupabaseAdmin();
  const { data: user, error: fetchError } = await admin
    .from("usuarios")
    .select("administrador")
    .eq("id", id)
    .single();
  if (fetchError || !user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  if (user.administrador) return NextResponse.json({ error: "Não é possível excluir um administrador." }, { status: 409 });

  // Delete public.usuarios first so FK violations from other tables (eventos,
  // equipe_usuarios, etc.) surface as a clear error before we touch auth.
  const { error: pubErr } = await admin.from("usuarios").delete().eq("id", id);
  if (pubErr) return NextResponse.json({ error: pubErr.message }, { status: 500 });

  // Then delete the auth.users row so the email can be reinvited later.
  // If only the auth delete fails we still return ok (the user is effectively
  // gone from the app); surface a warning so the admin can clean up.
  const { error: authErr } = await admin.auth.admin.deleteUser(id);
  if (authErr) {
    return NextResponse.json({
      ok: true,
      warning: `Usuário removido, mas a conta de autenticação permanece: ${authErr.message}`,
    });
  }
  return NextResponse.json({ ok: true });
}
