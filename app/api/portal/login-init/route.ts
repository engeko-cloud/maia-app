import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { randomInt } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/mail/send";

const Schema = z.object({
  cpf:   z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dados inválidos" }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const { cpf, email } = parsed.data;
  const admin = getSupabaseAdmin();

  // Validate CPF: check colaboradores row (email must match if set) OR afastamentos history.
  const { data: colab } = await admin
    .from("colaboradores")
    .select("email")
    .eq("cpf", cpf)
    .maybeSingle();

  if (colab) {
    if (colab.email && colab.email.toLowerCase() !== email) {
      return NextResponse.json(
        { error: "Email não corresponde ao cadastro. Entre em contato com o RH." },
        { status: 403 },
      );
    }
  } else {
    // Not in colaboradores — check afastamentos history.
    const { count, error: countError } = await admin
      .from("afastamentos")
      .select("id", { count: "exact", head: true })
      .eq("cpf", cpf);
    if (countError) return NextResponse.json({ error: "Erro interno." }, { status: 500 });
    if (!count) {
      return NextResponse.json({ error: "CPF não encontrado nos nossos registros." }, { status: 404 });
    }
  }

  // Reuse an active OTP (same CPF+email, unused, not yet expired) — refresh its expiry and resend.
  const now = new Date();
  const newExpiry = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

  const { data: existing } = await admin
    .from("portal_otp_codes")
    .select("id, code")
    .eq("cpf", cpf)
    .eq("email", email)
    .eq("used", false)
    .gt("expires_at", now.toISOString())
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  let code: string;

  if (existing) {
    code = existing.code;
    await admin
      .from("portal_otp_codes")
      .update({ expires_at: newExpiry })
      .eq("id", existing.id);
  } else {
    // Invalidate any stale codes for this CPF, then issue a fresh one.
    await admin
      .from("portal_otp_codes")
      .update({ used: true })
      .eq("cpf", cpf)
      .eq("used", false);

    code = String(randomInt(100000, 999999));
    const { error: insertError } = await admin
      .from("portal_otp_codes")
      .insert({ cpf, email, code, expires_at: newExpiry });
    if (insertError) return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }

  try {
    await sendMail({ template: "portal-otp", to: email, data: { code } });
  } catch {
    return NextResponse.json({ error: "Não foi possível enviar o código. Tente novamente." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
