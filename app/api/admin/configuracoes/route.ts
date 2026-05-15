import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = getSupabaseAdmin();
  const [{ data: cfg }, { data: dash }] = await Promise.all([
    admin.from("configuracoes").select("*").eq("id", 1).single(),
    admin.from("configuracoes_dashboard").select("config").eq("id", true).single(),
  ]);
  const aprovacao_lenta_horas: number = (dash?.config as { aprovacao_lenta_horas?: number } | null)?.aprovacao_lenta_horas ?? 24;
  return NextResponse.json({ ...cfg, aprovacao_lenta_horas });
}

const Patch = z.object({
  email_folha:           z.string().email().optional(),
  aprovacao_lenta_horas: z.number().int().min(1).max(720).optional(),
  portal_saudacao:       z.string().min(1).optional(),
  portal_vazio:          z.string().min(1).optional(),
  portal_banner:         z.string().min(1).optional(),
}).refine(
  (d) =>
    d.email_folha !== undefined ||
    d.aprovacao_lenta_horas !== undefined ||
    d.portal_saudacao !== undefined ||
    d.portal_vazio !== undefined ||
    d.portal_banner !== undefined,
  { message: "at least one field required" },
);

export async function PATCH(req: NextRequest) {
  const me = await requireAdminUser();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { email_folha, aprovacao_lenta_horas, portal_saudacao, portal_vazio, portal_banner } = parsed.data;

  const cfgFields: Record<string, unknown> = {};
  if (email_folha !== undefined)    cfgFields.email_folha = email_folha;
  if (portal_saudacao !== undefined) cfgFields.portal_saudacao = portal_saudacao;
  if (portal_vazio !== undefined)    cfgFields.portal_vazio = portal_vazio;
  if (portal_banner !== undefined)   cfgFields.portal_banner = portal_banner;

  if (Object.keys(cfgFields).length > 0) {
    const { error } = await admin.from("configuracoes")
      .update({ ...cfgFields, atualizado_em: new Date().toISOString(), atualizado_por: me.id })
      .eq("id", 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (aprovacao_lenta_horas !== undefined) {
    const { error } = await admin.from("configuracoes_dashboard")
      .upsert({ id: true, config: { aprovacao_lenta_horas }, atualizado_em: new Date().toISOString() }, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
