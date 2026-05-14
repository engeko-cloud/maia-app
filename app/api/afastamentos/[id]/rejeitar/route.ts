import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeEvento } from "@/lib/eventos";
import { canTransition } from "@/lib/afastamento-state";

// Corpo da requisição exige motivo com no mínimo 3 caracteres
const Body = z.object({ motivo: z.string().min(3) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Valida corpo antes de qualquer IO
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_motivo" }, { status: 400 });

  const supabase = await getSupabaseServer();

  // Verifica autenticação do usuário
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Verifica permissão: somente admin ou membro da equipe oh pode rejeitar
  const { data: usuario } = await supabase.from("usuarios").select("administrador").eq("id", user.id).single();
  const { data: m } = await supabase.from("equipe_usuarios").select("equipes!inner(codigo)").eq("usuario_id", user.id);
  const isOh = (m ?? []).some((r: any) => r.equipes?.codigo === "oh");
  if (!usuario?.administrador && !isOh) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Cliente admin para bypassar RLS no update
  const admin = getSupabaseAdmin();
  const { data: a } = await admin.from("afastamentos").select("situacao").eq("id", id).single();
  if (!a) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Valida transição via máquina de estados antes de qualquer escrita
  if (!canTransition(a.situacao as any, "rejeitado")) {
    return NextResponse.json({ error: "invalid_transition", from: a.situacao }, { status: 409 });
  }

  // Atualiza situação para rejeitado com motivo de rejeição
  await admin.from("afastamentos")
    .update({
      situacao:         "rejeitado",
      decidido_por:     user.id,
      decidido_em:      new Date().toISOString(),
      motivo_rejeicao:  parsed.data.motivo,
    })
    .eq("id", id);

  // Registra evento de auditoria com o motivo
  await writeEvento(admin, {
    tipoEntidade: "afastamento", entidadeId: id, evento: "rejeitado",
    autorId: user.id, dados: { motivo: parsed.data.motivo },
  });

  // E-mail de rejeição com token de edição adicionado na Task 15
  return NextResponse.json({ ok: true });
}
