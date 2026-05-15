import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deletePortalSession } from "@/lib/portal-session";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("portal_session")?.value;
  if (token) {
    await deletePortalSession(token);
  }
  cookieStore.set("portal_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/portal",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
