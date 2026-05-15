import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function autoRegisterColaborador(
  authId: string,
  cpf: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("colaboradores")
    .upsert({ cpf, email, auth_id: authId }, { onConflict: "cpf" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
