import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface RecipientSources {
  getSafetyEmails: () => Promise<string[]>;
  getAdminEmails:  () => Promise<string[]>;
}

/** Resolve recipients: active safety equipe members, falling back to active admins. Dedupes. */
export async function resolveSafetyRecipients(sources: RecipientSources): Promise<string[]> {
  const safety = await sources.getSafetyEmails();
  const list   = safety.length ? safety : await sources.getAdminEmails();
  return Array.from(new Set(list));
}

/** Production sources backed by the service-role Supabase client. */
export function makeSupabaseRecipientSources(
  admin: SupabaseClient<Database>,
): RecipientSources {
  return {
    async getSafetyEmails() {
      const { data, error } = await admin
        .from("equipe_usuarios")
        .select("usuarios!inner(email, ativo), equipes!inner(codigo)")
        .eq("equipes.codigo", "safety")
        .eq("usuarios.ativo", true);
      if (error || !data) return [];
      return data
        .map((r) => (r.usuarios as unknown as { email: string }).email)
        .filter(Boolean);
    },
    async getAdminEmails() {
      const { data, error } = await admin
        .from("usuarios")
        .select("email")
        .eq("administrador", true)
        .eq("ativo", true);
      if (error || !data) return [];
      return data.map((r) => r.email).filter(Boolean);
    },
  };
}
