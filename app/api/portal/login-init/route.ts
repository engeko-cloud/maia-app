import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const Schema = z.object({
  cpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
});

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }
  const { cpf, email } = parsed.data;
  const admin = getSupabaseAdmin();

  // Check if CPF is pre-registered by admin.
  const { data: colab } = await admin
    .from("colaboradores")
    .select("email, auth_id")
    .eq("cpf", cpf)
    .single();

  if (colab) {
    if (colab.email && colab.email.toLowerCase() !== email) {
      return NextResponse.json(
        { error: "Email não corresponde ao cadastro. Entre em contato com o RH." },
        { status: 403 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  // CPF not pre-registered — check afastamentos records.
  const { count, error: countError } = await admin
    .from("afastamentos")
    .select("id", { count: "exact", head: true })
    .eq("cpf", cpf);

  if (countError) return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  if (!count) {
    return NextResponse.json(
      { error: "CPF não encontrado nos nossos registros." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
