import { layout } from "./_layout";

export function portalOtp(data: { code: string }): string {
  const body = `
    <p style="margin:16px 0;">Use o código abaixo para acessar a Área do Colaborador. Ele expira em <strong>10 minutos</strong>.</p>
    <div style="margin:24px 0;padding:20px;background:#f4f4f5;border-radius:8px;text-align:center;">
      <span style="font-size:36px;font-weight:700;letter-spacing:8px;font-variant-numeric:tabular-nums;">${data.code}</span>
    </div>
    <p style="margin:16px 0;font-size:13px;color:#71717a;">Se você não solicitou este código, ignore este email.</p>
  `;
  return layout("Seu código de acesso", body);
}
