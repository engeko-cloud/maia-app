import { EMAIL_COLORS, EMAIL_FONT } from "./tokens";
import { escapeHtml } from "./_escape";

const ENGEKO_LOGO = "https://xgmyommohllxqbiggstd.supabase.co/storage/v1/object/public/support/engeko-logo.png";
const FAPPTORY_LOGO = "https://xgmyommohllxqbiggstd.supabase.co/storage/v1/object/public/support/fapptory-logo.png";

export function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;background:${EMAIL_COLORS.bg};font-family:${EMAIL_FONT};color:${EMAIL_COLORS.fg};">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="margin:0 0 16px;">
      <img src="${ENGEKO_LOGO}" alt="ENGEKO" width="110" height="21" style="display:block;border:0;" />
    </div>
    <h2 style="font-size:18px;margin:16px 0;">${escapeHtml(title)}</h2>
    ${bodyHtml}
    <div style="border-top:1px solid ${EMAIL_COLORS.border};margin-top:32px;padding-top:16px;">
      <p style="font-size:12px;color:${EMAIL_COLORS.muted};margin:0 0 12px;">Esta é uma mensagem automática. Não responda a este email.</p>
      <a href="https://fapptory.me" target="_blank" rel="noreferrer noopener" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none;color:${EMAIL_COLORS.muted};">
        <span style="font-size:12px;">Feito por</span>
        <img src="${FAPPTORY_LOGO}" alt="Fapptory" width="56" height="12" style="display:inline-block;vertical-align:middle;border:0;" />
      </a>
    </div>
  </div>
</body>
</html>`;
}
