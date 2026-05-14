import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
  if (file.size > MAX_SIZE)    return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "bad_mime" }, { status: 415 });

  const supabase = getSupabaseAdmin();
  const path = `afastamentos/staging/${crypto.randomUUID()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from("attachments").upload(path, buffer, {
    contentType: file.type, upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ url: path });
}
