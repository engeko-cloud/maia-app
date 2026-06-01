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

  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "https://maia-app-five.vercel.app";
  const admin = getSupabaseAdmin();

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: parsed.data.email,
    options: { redirectTo: `${baseUrl}/app/painel` },
  });

  // Build our own confirm URL using hashed_token instead of Supabase's
  // action_link. Supabase's verify endpoint returns the session in the URL
  // fragment (implicit flow), which the Next.js server can't see — so cookies
  // never get set and the user bounces. /auth/confirm calls verifyOtp
  // server-side, sets the session cookie, then redirects to `next`.
  if (!linkErr && linkData?.properties?.hashed_token) {
    const magicUrl =
      `${baseUrl}/auth/confirm` +
      `?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}` +
      `&type=email` +
      `&next=${encodeURIComponent("/app/painel")}`;
    try {
      await sendMail({
        template: "magic-link",
        to: parsed.data.email,
        data: { m: { magicUrl } },
      });
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json({ ok: true });
}
