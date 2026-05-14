import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeEvento } from "@/lib/eventos";
import { canTransition } from "@/lib/afastamento-state";

// Corpo opcional: motivo de cancelamento pode ser omitido
const Body = z.object({ motivo: z.string().optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Aceita corpo vazio ou JSON com motivo opcional
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  const supabase = await getSupabaseServer();

  // Verifica autenticação do usuário
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Verifica permissão: somente admin pode cancelar (equipe oh não tem acesso)
  const { data: usuario } = await supabase.from("usuarios").select("administrador").eq("id", user.id).single();
  if (!usuario?.administrador) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Cliente admin para bypassar RLS no update
  const admin = getSupabaseAdmin();
  const { data: a } = await admin.from("afastamentos").select("situacao").eq("id", id).single();
  if (!a) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Valida transição via máquina de estados antes de qualquer escrita
  if (!canTransition(a.situacao as any, "cancelado")) {
    return NextResponse.json({ error: "invalid_transition", from: a.situacao }, { status: 409 });
  }

  // Atualiza situação para cancelado
  await admin.from("afastamentos")
    .update({ situacao: "cancelado", decidido_por: user.id, decidido_em: new Date().toISOString() })
    .eq("id", id);

  // Registra evento de auditoria, incluindo motivo se fornecido
  await writeEvento(admin, {
    tipoEntidade: "afastamento", entidadeId: id, evento: "cancelado",
    autorId: user.id, dados: parsed.data.motivo ? { motivo: parsed.data.motivo } : {},
  });

  return NextResponse.json({ ok: true });
}
