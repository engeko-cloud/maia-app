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
  const aprovacao_lenta_horas: number = (dash?.config as { aprovacao_lenta_horas?: number } | null)?.aprovacao_lenta_horas ?? 48;
  return NextResponse.json({ ...cfg, aprovacao_lenta_horas });
}

const Patch = z.object({
  email_folha: z.string().email().optional(),
  aprovacao_lenta_horas: z.number().int().min(1).max(720).optional(),
}).refine((d) => d.email_folha !== undefined || d.aprovacao_lenta_horas !== undefined, {
  message: "at least one field required",
});

export async function PATCH(req: NextRequest) {
  const me = await requireAdminUser();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { email_folha, aprovacao_lenta_horas } = parsed.data;

  if (email_folha !== undefined) {
    const { error } = await admin.from("configuracoes")
      .update({ email_folha, atualizado_em: new Date().toISOString(), atualizado_por: me.id })
      .eq("id", 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (aprovacao_lenta_horas !== undefined) {
    const { error } = await admin.from("configuracoes_dashboard")
      .upsert({ id: true, config: { aprovacao_lenta_horas } }, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
