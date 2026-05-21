import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const SIGNED_URL_TTL_SECONDS = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: row } = await supabase
    .from("afastamentos")
    .select("arquivo_url")
    .eq("token_edicao", token)
    .single();

  if (!row?.arquivo_url) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(row.arquivo_url, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error("[public/afastamentos/anexo] sign failed", { path: row.arquivo_url, message: error?.message });
    return NextResponse.json({ error: error?.message ?? "sign_failed" }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
