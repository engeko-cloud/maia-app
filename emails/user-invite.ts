import { layout } from "./_layout";
import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";

export function userInvite(data: { inviteUrl: string; nome: string }): string {
  const { inviteUrl, nome } = data;
  const body = `
    <p style="margin:16px 0;">Olá ${escapeHtml(nome)}, sua conta no MAIA foi criada. Clique no botão abaixo para definir sua senha.</p>
    <div style="margin-top:16px;">
      <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:${EMAIL_COLORS.primary};color:${EMAIL_COLORS.primaryFg};padding:10px 16px;border-radius:6px;text-decoration:none;">Definir senha</a>
    </div>
  `;
  return layout("Acesso ao MAIA", body);
}
