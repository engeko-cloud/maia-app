import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const Schema = z.object({
  cpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
  email: z.string().trim().toLowerCase().email("Email inválido").nullable().optional(),
});

export async function GET() {
  if (!(await requireAdminUser())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("colaboradores")
    .select("cpf, email, auth_id, criado_em")
    .order("criado_em", { ascending: false });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdminUser())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dados inválidos" }, { status: 400 }); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("colaboradores")
    .insert({ cpf: parsed.data.cpf, email: parsed.data.email ?? null })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "CPF já cadastrado." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
