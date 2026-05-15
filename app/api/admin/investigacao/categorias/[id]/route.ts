import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
// buildCategoriaInUseQuery (lib/investigacao-fk-check.ts) documents the
// equivalent psql query for the DELETE-time invariant enforced below.

const Patch = z.object({
  ordem: z.number().int().min(0).optional(),
  ativo: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("investigacao_categorias").update(parsed.data).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const admin = getSupabaseAdmin();

  // jsonb pre-check: refuse delete if any investigacao references this categoria_id.
  // supabase-js does not expose raw SQL with bind params, so we use the typed
  // `.contains()` API against the `dados` jsonb column.
  const { data: rows } = await admin
    .from("investigacoes")
    .select("id")
    .contains("dados", { ishikawa: [{ categoria_id: id }] })
    .limit(1);
  if (rows && rows.length > 0) {
    return NextResponse.json(
      { error: "Em uso por investigações existentes. Desative em vez de excluir." },
      { status: 409 },
    );
  }

  const { error } = await admin.from("investigacao_categorias").delete().eq("id", id);
  if (error?.code === "23503") {
    return NextResponse.json(
      { error: "Em uso por investigações existentes. Desative em vez de excluir." },
      { status: 409 },
    );
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
