import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/admin-auth";
import { sendMail } from "@/lib/mail/send";

export async function GET() {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("usuarios")
    .select("id, nome, sobrenome, email, administrador, ativo, criado_em")
    .order("criado_em", { ascending: false });
  return NextResponse.json(data);
}

const Body = z.object({
  email: z.string().email(),
  nome:  z.string().min(2),
  sobrenome: z.string().optional(),
  administrador: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const me = await requireAdminUser();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  const admin = getSupabaseAdmin();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: "Mudar123",
    email_confirm: true,
  });
  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });

  const { error: insErr } = await admin.from("usuarios").upsert({
    id: created.user.id,
    email: parsed.data.email,
    nome: parsed.data.nome,
    sobrenome: parsed.data.sobrenome,
    administrador: parsed.data.administrador ?? false,
    criado_por: me.id,
    primeiro_acesso: true,
  } as any, { onConflict: "id" });

  if (insErr) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? "";
  try {
    await sendMail({
      template: "user-invite",
      to: parsed.data.email,
      data: {
        u: {
          nome: parsed.data.nome,
          email: parsed.data.email,
          loginUrl: `${baseUrl}/login`,
        },
      },
    });
  } catch {
    // Email failure is non-fatal — user was created.
  }

  return NextResponse.json({ id: created.user.id });
}
