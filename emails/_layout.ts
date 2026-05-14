import { EMAIL_COLORS, EMAIL_FONT } from "./tokens";
import { escapeHtml } from "./_escape";

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
    <h1 style="font-size:20px;color:${EMAIL_COLORS.primary};margin:0 0 8px;">MAIA · ENGEKO</h1>
    <h2 style="font-size:18px;margin:16px 0;">${escapeHtml(title)}</h2>
    ${bodyHtml}
    <div style="border-top:1px solid ${EMAIL_COLORS.border};margin-top:32px;padding-top:16px;">
      <p style="font-size:12px;color:${EMAIL_COLORS.muted};margin:0;">Esta é uma mensagem automática. Não responda a este email.</p>
    </div>
  </div>
</body>
</html>`;
}
