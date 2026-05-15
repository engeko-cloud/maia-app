import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createPortalSession } from "@/lib/portal-session";

const Schema = z.object({
  cpf:   z.string().regex(/^\d{11}$/),
  email: z.string().trim().toLowerCase().email(),
  code:  z.string().length(6),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dados inválidos" }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { cpf, email, code } = parsed.data;
  const admin = getSupabaseAdmin();

  // Find a valid, unused OTP for this CPF+email+code that has not expired.
  const { data: otp, error: otpError } = await admin
    .from("portal_otp_codes")
    .select("id")
    .eq("cpf", cpf)
    .eq("email", email)
    .eq("code", code)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (otpError) return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  if (!otp) {
    return NextResponse.json({ error: "Código inválido ou expirado." }, { status: 401 });
  }

  // Mark OTP as used.
  await admin.from("portal_otp_codes").update({ used: true }).eq("id", otp.id);

  // Upsert colaboradores row (handles both first-time and returning colaboradores).
  await admin
    .from("colaboradores")
    .upsert({ cpf, email }, { onConflict: "cpf", ignoreDuplicates: false });

  // Create session and set cookie.
  const token = await createPortalSession(cpf);
  const cookieStore = await cookies();
  cookieStore.set("portal_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/portal",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ ok: true });
}
