import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeEvento } from "@/lib/eventos";
import { canTransition } from "@/lib/afastamento-state";
import { sendMail } from "@/lib/mail/send";

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
  const { error: upErr } = await admin.from("afastamentos")
    .update({
      situacao:         "rejeitado",
      decidido_por:     user.id,
      decidido_em:      new Date().toISOString(),
      motivo_rejeicao:  parsed.data.motivo,
    })
    .eq("id", id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Registra evento de auditoria com o motivo
  await writeEvento(admin, {
    tipoEntidade: "afastamento", entidadeId: id, evento: "rejeitado",
    autorId: user.id, dados: { motivo: parsed.data.motivo },
  });

  const { data: full } = await admin
    .from("afastamentos")
    .select(`*, empresas!inner(nome), unidades!inner(nome), afastamento_tipos!inner(rotulo)`)
    .eq("id", id).single();

  if (full?.email_remetente) {
    const base = process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:3000";
    const editUrl = `${base}/afastamentos/editar/${full.token_edicao}`;

    const emailA = {
      serial_id:        full.serial_id,
      colaborador_nome: full.colaborador_nome,
      cpf:              full.cpf,
      tipo_rotulo:      (full.afastamento_tipos as any).rotulo,
      data_inicio:      full.data_inicio,
      data_fim:         full.data_fim,
      empresa_nome:     (full.empresas as any).nome,
      unidade_nome:     (full.unidades as any).nome,
      situacao:         "rejeitado",
      cid:              full.cid,
      status_url:       `${base}/afastamentos/status/${full.token_edicao}`,
    };

    try {
      await sendMail({ template: "afastamento-rejected", to: full.email_remetente,
        data: { a: emailA, motivo: parsed.data.motivo, editUrl } });
      await writeEvento(admin, { tipoEntidade: "afastamento", entidadeId: id,
        evento: "email_enviado", autorId: user.id, dados: { template: "afastamento-rejected" } });
    } catch (err: any) {
      await writeEvento(admin, { tipoEntidade: "afastamento", entidadeId: id,
        evento: "email_enviado", autorId: user.id, dados: { template: "afastamento-rejected", error: err.message } });
    }
  }

  return NextResponse.json({ ok: true });
}
