import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const SESSION_TTL_DAYS = 7;

export async function createPortalSession(cpf: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires_at = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("portal_sessions").insert({ token, cpf, expires_at });
  if (error) throw new Error(error.message);
  return token;
}

export async function getPortalSession(token: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("portal_sessions")
    .select("cpf")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data?.cpf ?? null;
}

export async function deletePortalSession(token: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from("portal_sessions").delete().eq("token", token);
}
