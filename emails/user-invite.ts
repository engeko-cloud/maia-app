import { layout } from "./_layout";
import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";

export type UserInviteEmail = {
  nome: string;
  email: string;
  loginUrl: string;
};

export function userInvite(data: { u: UserInviteEmail }): string {
  const { nome, email, loginUrl } = data.u;
  const body = `
    <p style="margin:16px 0;">Olá ${escapeHtml(nome)}, sua conta no MAIA foi criada.</p>
    <p style="margin:16px 0;">
      Acesse com o email <strong>${escapeHtml(email)}</strong> e a senha temporária <strong>Mudar123</strong>.<br/>
      Na primeira entrada, o sistema pedirá que você defina sua própria senha.
    </p>
    <div style="margin-top:16px;">
      <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:${EMAIL_COLORS.primary};color:${EMAIL_COLORS.primaryFg};padding:10px 16px;border-radius:6px;text-decoration:none;">Acessar o MAIA</a>
    </div>
    <p style="margin-top:16px;font-size:13px;color:${EMAIL_COLORS.muted};">Se não reconhece este email, ignore esta mensagem.</p>
  `;
  return layout("Sua conta no MAIA foi criada", body);
}
