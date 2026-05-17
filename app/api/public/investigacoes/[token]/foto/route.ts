import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FOTOS_PER_INVESTIGACAO = 10;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const EDITABLE = new Set(["em_andamento", "rejeitada"]);

// Upload de fotos público via token. Mesmas regras (5MB, 10 max, jpeg/png/webp)
// da rota privada; diferença é auth por token em vez de sessão.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const admin = getSupabaseAdmin();
  const { data: inv, error: invErr } = await admin
    .from("investigacoes")
    .select("id, ocorrencia_id, situacao, dados")
    .eq("token_publico", token)
    .single();
  if (invErr || !inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!EDITABLE.has(inv.situacao)) {
    return NextResponse.json({ error: "not_editable", situacao: inv.situacao }, { status: 409 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large", max_bytes: MAX_BYTES }, { status: 413 });
  if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: "invalid_mime", allowed: [...ALLOWED_MIME] }, { status: 415 });

  const fotos = (inv.dados as { fotos?: unknown[] } | null)?.fotos ?? [];
  if (Array.isArray(fotos) && fotos.length >= MAX_FOTOS_PER_INVESTIGACAO) {
    return NextResponse.json({ error: "max_fotos_reached", max: MAX_FOTOS_PER_INVESTIGACAO }, { status: 409 });
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `investigacoes/${inv.ocorrencia_id}/${randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await admin.storage
    .from("attachments")
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  return NextResponse.json({ path });
}
