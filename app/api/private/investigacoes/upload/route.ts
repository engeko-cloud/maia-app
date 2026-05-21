import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { requireSafetyOrAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sanitizeStorageKey } from "@/lib/sanitize-storage-key";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FOTOS_PER_INVESTIGACAO = 10;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  const user = await requireSafetyOrAdmin();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  const ocorrenciaId = form.get("ocorrencia_id");
  if (!(file instanceof File) || typeof ocorrenciaId !== "string") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large", max_bytes: MAX_BYTES }, { status: 413 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "invalid_mime", allowed: [...ALLOWED_MIME] }, { status: 415 });
  }

  const admin = getSupabaseAdmin();

  const { data: inv, error: invErr } = await admin
    .from("investigacoes")
    .select("dados")
    .eq("ocorrencia_id", ocorrenciaId)
    .single();
  if (invErr || !inv) {
    return NextResponse.json({ error: "investigacao_not_found" }, { status: 404 });
  }
  const fotos = (inv.dados as { fotos?: unknown[] } | null)?.fotos ?? [];
  if (Array.isArray(fotos) && fotos.length >= MAX_FOTOS_PER_INVESTIGACAO) {
    return NextResponse.json({ error: "max_fotos_reached", max: MAX_FOTOS_PER_INVESTIGACAO }, { status: 409 });
  }

  const safeName = sanitizeStorageKey(file.name);
  const path = `investigacoes/${ocorrenciaId}/${randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await admin.storage
    .from("attachments")
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }
  return NextResponse.json({ path });
}
