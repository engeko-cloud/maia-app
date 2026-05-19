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
    type: "magiclink",
    email: parsed.data.email,
    options: { redirectTo: `${baseUrl}/app/painel` },
  });

  if (!linkErr && linkData?.properties?.action_link) {
    try {
      await sendMail({
        template: "magic-link",
        to: parsed.data.email,
        data: { m: { magicUrl: linkData.properties.action_link } },
      });
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json({ ok: true });
}
