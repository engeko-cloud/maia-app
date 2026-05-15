import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("eventos_lidos")
    .upsert({ usuario_id: user.id, evento_id: id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({});
}
