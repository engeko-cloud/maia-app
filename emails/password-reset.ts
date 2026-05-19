import { layout } from "./_layout";
import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";

export type PasswordResetEmail = {
  resetUrl: string;
};

export function passwordReset(data: { p: PasswordResetEmail }): string {
  const { resetUrl } = data.p;
  const body = `
    <p style="margin:16px 0;">Você solicitou redefinir sua senha no MAIA. Clique no botão abaixo para criar uma nova senha.</p>
    <div style="margin-top:16px;">
      <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:${EMAIL_COLORS.primary};color:${EMAIL_COLORS.primaryFg};padding:10px 16px;border-radius:6px;text-decoration:none;">Redefinir senha</a>
    </div>
    <p style="margin-top:16px;font-size:13px;color:${EMAIL_COLORS.muted};">O link expira em 1 hora. Se não foi você, ignore este email — sua senha não será alterada.</p>
  `;
  return layout("Redefinir senha no MAIA", body);
}
