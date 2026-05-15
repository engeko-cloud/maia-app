import { NextResponse, type NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ cpf: string }> },
) {
  if (!(await requireAdminUser())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { cpf } = await params;
  const admin = getSupabaseAdmin();
  const { error, count } = await admin
    .from("colaboradores")
    .delete({ count: "exact" })
    .eq("cpf", cpf);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (count === 0) return NextResponse.json({ error: "CPF não encontrado." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
