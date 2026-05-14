import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeEvento } from "@/lib/eventos";
import { canTransition } from "@/lib/afastamento-state";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  // Verifica autenticação do usuário
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Verifica permissão: somente admin ou membro da equipe oh pode aprovar
  const { data: usuario } = await supabase.from("usuarios").select("administrador").eq("id", user.id).single();
  const { data: m } = await supabase.from("equipe_usuarios").select("equipes!inner(codigo)").eq("usuario_id", user.id);
  const isOh = (m ?? []).some((r: any) => r.equipes?.codigo === "oh");
  if (!usuario?.administrador && !isOh) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Cliente admin para bypassar RLS no update (não há políticas de escrita)
  const admin = getSupabaseAdmin();
  const { data: a, error: aErr } = await admin.from("afastamentos").select("situacao").eq("id", id).single();
  if (aErr || !a) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Valida transição via máquina de estados antes de qualquer escrita
  if (!canTransition(a.situacao as any, "finalizado")) {
    return NextResponse.json({ error: "invalid_transition", from: a.situacao }, { status: 409 });
  }

  // Atualiza situação para finalizado (envio Fluig adicionado na Task 14)
  const { error: upErr } = await admin
    .from("afastamentos")
    .update({ situacao: "finalizado", decidido_por: user.id, decidido_em: new Date().toISOString() })
    .eq("id", id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Registra evento de auditoria
  await writeEvento(admin, {
    tipoEntidade: "afastamento", entidadeId: id, evento: "aprovado", autorId: user.id,
  });

  // Envio de e-mail adicionado na Task 15
  return NextResponse.json({ ok: true });
}
