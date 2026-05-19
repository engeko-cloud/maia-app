import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/mail/send";

const Body = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ ok: true });

  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? "";
  const admin = getSupabaseAdmin();

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: parsed.data.email,
    options: { redirectTo: `${baseUrl}/update-password` },
  });

  if (!linkErr && linkData?.properties?.action_link) {
    try {
      await sendMail({
        template: "password-reset",
        to: parsed.data.email,
        data: { p: { resetUrl: linkData.properties.action_link } },
      });
    } catch {
    }
  }

  return NextResponse.json({ ok: true });
}
