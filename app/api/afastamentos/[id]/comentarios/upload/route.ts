import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: usuario }, { data: m }] = await Promise.all([
    supabase.from("usuarios").select("administrador").eq("id", user.id).single(),
    supabase.from("equipe_usuarios").select("equipes!inner(codigo)").eq("usuario_id", user.id),
  ]);
  const isOh = (m ?? []).some((r: any) => r.equipes?.codigo === "oh");
  if (!usuario?.administrador && !isOh) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "bad_mime" }, { status: 415 });

  const admin = getSupabaseAdmin();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `afastamentos/comentarios/${id}/${crypto.randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage.from("attachments").upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ path, nome: file.name });
}
