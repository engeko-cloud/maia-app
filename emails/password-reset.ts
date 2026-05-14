// Template usado apenas para gerar HTML (em scripts/output/password-reset.html)
// e colar no Supabase Dashboard → Auth → Email Templates → Reset password.
// Não é despachado via lib/mail/send.ts: o envio é feito pelo Supabase quando
// auth.resetPasswordForEmail() é chamado em app/(auth)/forgot-password/page.tsx.
import { layout } from "./_layout";
import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";

export function passwordReset(data: { resetUrl: string }): string {
  const { resetUrl } = data;
  const body = `
    <p style="margin:16px 0;">Você solicitou redefinir sua senha. Clique no botão abaixo. Se não foi você, ignore este email.</p>
    <div style="margin-top:16px;">
      <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:${EMAIL_COLORS.primary};color:${EMAIL_COLORS.primaryFg};padding:10px 16px;border-radius:6px;text-decoration:none;">Redefinir senha</a>
    </div>
  `;
  return layout("Redefinir senha", body);
}
