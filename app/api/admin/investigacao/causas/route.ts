import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const Schema = z.object({
  categoria_id: z.string().uuid(),
  texto:        z.string().min(2),
  ordem:        z.number().int().min(0).optional(),
  ativo:        z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = getSupabaseAdmin();
  const categoriaId = new URL(req.url).searchParams.get("categoria_id");
  let q = admin.from("investigacao_causas").select("*").order("ordem");
  if (categoriaId) q = q.eq("categoria_id", categoriaId);
  const { data } = await q;
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("investigacao_causas").insert(parsed.data).select().single();
  if (error?.code === "23505") {
    return NextResponse.json({ error: "Já existe uma causa com este texto nesta categoria." }, { status: 409 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
