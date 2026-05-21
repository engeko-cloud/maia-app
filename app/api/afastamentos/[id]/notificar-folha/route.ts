import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeEvento } from "@/lib/eventos";
import { sendMail } from "@/lib/mail/send";

const MAX_RECIPIENTS = 50;

const Body = z.object({
  emails:   z.string().min(1, "Informe ao menos um destinatário."),
  mensagem: z.string().max(2000).optional(),
});

function parseEmails(raw: string): { ok: string[]; invalid: string[] } {
  const tokens = raw
    .split(/[,;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const ok: string[] = [];
  const invalid: string[] = [];
  const emailSchema = z.string().email();
  for (const t of tokens) {
    const lower = t.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    if (emailSchema.safeParse(t).success) ok.push(t);
    else invalid.push(t);
  }
  return { ok, invalid };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: usuario } = await supabase.from("usuarios").select("administrador").eq("id", user.id).single();
  const { data: m } = await supabase
    .from("equipe_usuarios")
    .select("equipes!inner(codigo)")
    .eq("usuario_id", user.id)
    .returns<{ equipes: { codigo: string } | null }[]>();
  const isOh = (m ?? []).some((r) => r.equipes?.codigo === "oh");
  if (!usuario?.administrador && !isOh) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });

  const { ok: recipients, invalid } = parseEmails(parsed.data.emails);
  if (invalid.length > 0) {
    return NextResponse.json({ error: "invalid_emails", invalid }, { status: 400 });
  }
  if (recipients.length === 0) {
    return NextResponse.json({ error: "no_recipients" }, { status: 400 });
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: "too_many_recipients", max: MAX_RECIPIENTS }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: full, error: fullErr } = await admin
    .from("afastamentos")
    .select(`id, serial_id, token_edicao, situacao, cpf, colaborador_nome,
             data_inicio, data_fim, cid,
             empresas!inner(nome),
             unidades!inner(nome),
             afastamento_tipos!inner(rotulo, requer_aprovacao)`)
    .eq("id", id)
    .single();
  if (fullErr || !full) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (full.situacao !== "finalizado") {
    return NextResponse.json({ error: "invalid_situacao", situacao: full.situacao }, { status: 409 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "";
  const tipo = full.afastamento_tipos as { rotulo: string; requer_aprovacao: boolean };
  const template = tipo.requer_aprovacao ? "folha-approved-medical" : "folha-auto-accept";

  const emailA = {
    serial_id:        full.serial_id,
    colaborador_nome: full.colaborador_nome,
    cpf:              full.cpf,
    tipo_rotulo:      tipo.rotulo,
    data_inicio:      full.data_inicio,
    data_fim:         full.data_fim,
    empresa_nome:     (full.empresas as { nome: string }).nome,
    unidade_nome:     (full.unidades as { nome: string }).nome,
    situacao:         "finalizado",
    cid:              full.cid,
    status_url:       baseUrl ? `${baseUrl}/afastamentos/status/${full.token_edicao}` : undefined,
    mensagem:         parsed.data.mensagem ?? null,
  };

  try {
    await sendMail({ template, to: recipients, data: { a: emailA } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeEvento(admin, {
      tipoEntidade: "afastamento", entidadeId: id,
      evento: "email_enviado", autorId: user.id,
      dados: { template, to: recipients, manual: true, error: msg },
    });
    return NextResponse.json({ error: "send_failed", message: msg }, { status: 502 });
  }

  await writeEvento(admin, {
    tipoEntidade: "afastamento", entidadeId: id,
    evento: "email_enviado", autorId: user.id,
    dados: {
      template,
      to: recipients,
      manual: true,
      mensagem_len: (parsed.data.mensagem ?? "").trim().length,
    },
  });

  return NextResponse.json({ ok: true, to: recipients });
}
