import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/admin-auth";

// zod v4's z.string().uuid() strictly enforces RFC 9562 version digit 1-8 and
// rejects otherwise well-formed UUID-shaped values. Mirror the permissive
// pattern used elsewhere in the codebase (see lib/investigacao-dados.ts).
const UuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const Body = z.object({ usuario_id: z.string().regex(UuidRegex, "UUID inválido") });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "validação falhou" },
      { status: 400 },
    );
  }
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("equipe_usuarios")
    .insert({ equipe_id: id, usuario_id: parsed.data.usuario_id });
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Usuário já é membro desta equipe." }, { status: 409 });
    }
    if (error.code === "23503") {
      return NextResponse.json({ error: "Usuário ou equipe não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const usuario_id = new URL(req.url).searchParams.get("usuario_id");
  if (!usuario_id) return NextResponse.json({ error: "missing_usuario_id" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("equipe_usuarios").delete()
    .eq("equipe_id", id).eq("usuario_id", usuario_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
