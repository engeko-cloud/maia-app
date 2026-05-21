import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Vercel serverless functions reject request bodies >4.5 MB at the edge
// (returns HTML 413 before the function runs). We cap below that to leave
// headroom for multipart/form-data boundary overhead.
const MAX_SIZE = 4 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  try {
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
    if (error) {
      console.error("[afastamentos/upload] supabase upload failed", { path, mime: file.type, size: file.size, message: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ url: path });
  } catch (err) {
    console.error("[afastamentos/upload] unhandled", err);
    const message = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
