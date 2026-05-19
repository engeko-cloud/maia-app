import { layout } from "./_layout";
import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";

export type MagicLinkEmail = {
  magicUrl: string;
};

export function magicLink(data: { m: MagicLinkEmail }): string {
  const { magicUrl } = data.m;
  const body = `
    <p style="margin:16px 0;">Você solicitou acesso ao MAIA sem senha. Clique no botão abaixo para entrar.</p>
    <div style="margin-top:16px;">
      <a href="${escapeHtml(magicUrl)}" style="display:inline-block;background:${EMAIL_COLORS.primary};color:${EMAIL_COLORS.primaryFg};padding:10px 16px;border-radius:6px;text-decoration:none;">Acessar o MAIA</a>
    </div>
    <p style="margin-top:16px;font-size:13px;color:${EMAIL_COLORS.muted};">O link expira em 1 hora. Se não foi você, ignore este email.</p>
  `;
  return layout("Link de acesso ao MAIA", body);
}
