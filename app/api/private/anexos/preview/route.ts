import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const SIGNED_URL_TTL_SECONDS = 60;
const ALLOWED_PREFIXES = ["afastamentos/", "investigacoes/"];

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const path = req.nextUrl.searchParams.get("path");
  if (!path || !ALLOWED_PREFIXES.some((p) => path.startsWith(p))) {
    return NextResponse.json({ error: "bad_path" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from("attachments")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? "not_found" }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
