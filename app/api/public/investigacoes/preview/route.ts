import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// 1-hour TTL — sufficient for an open report tab without re-fetching.
const SIGNED_URL_TTL_SECONDS = 3600;

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path || !path.startsWith("investigacoes/")) {
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
