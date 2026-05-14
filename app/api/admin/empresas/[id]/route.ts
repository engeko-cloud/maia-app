import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const Patch = z.object({
  nome: z.string().optional(),
  razao_social: z.string().optional(),
  cnpj: z.string().regex(/^\d{14}$/).optional(),
  codigo_soc: z.string().optional(),
  codigo_fluig: z.string().optional(),
  ativo: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("empresas").update(parsed.data).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("empresas").delete().eq("id", id);
  if (error?.code === "23503") {
    return NextResponse.json({ error: "Em uso por afastamentos ou ocorrências. Desative em vez de excluir." }, { status: 409 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
