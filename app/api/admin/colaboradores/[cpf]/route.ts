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
  const { error } = await admin.from("colaboradores").delete().eq("cpf", cpf);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
