import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function autoRegisterColaborador(
  authId: string,
  cpf: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdmin();

  // Try to link an existing pre-registered row (only if auth_id is unset).
  const { error: updateError, count } = await admin
    .from("colaboradores")
    .update({ auth_id: authId, email })
    .eq("cpf", cpf)
    .is("auth_id", null);

  if (updateError) return { ok: false, error: updateError.message };
  if (count && count > 0) return { ok: true };

  // Zero rows updated — either row doesn't exist, or auth_id is already set.
  const { data: existing, error: findError } = await admin
    .from("colaboradores")
    .select("auth_id")
    .eq("cpf", cpf)
    .maybeSingle();

  if (findError) return { ok: false, error: findError.message };
  if (existing) return { ok: true }; // already linked (idempotent)

  // CPF has no colaboradores row yet — insert (afastamentos-only path).
  const { error: insertError } = await admin
    .from("colaboradores")
    .insert({ cpf, email, auth_id: authId });

  if (insertError) return { ok: false, error: insertError.message };
  return { ok: true };
}
