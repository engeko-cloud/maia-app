import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const Schema = z.object({
  codigo: z.string().min(1),
  rotulo: z.string().min(2),
  ordem:  z.number().int().min(0).optional(),
  ativo:  z.boolean().optional(),
});

export async function GET() {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("investigacao_graus").select("*").order("ordem");
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("investigacao_graus").insert(parsed.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
