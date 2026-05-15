import { cookies } from "next/headers";
import { getPortalSession } from "@/lib/portal-session";

export type PortalSession = { cpf: string };

export async function requirePortalSession(): Promise<PortalSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("portal_session")?.value;
  if (!token) return null;
  const cpf = await getPortalSession(token);
  if (!cpf) return null;
  return { cpf };
}
