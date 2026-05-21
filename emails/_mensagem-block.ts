import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";

export function mensagemBlock(mensagem: string | null | undefined): string {
  const trimmed = (mensagem ?? "").trim();
  if (!trimmed) return "";
  return `<div style="margin:16px 0;padding:12px 14px;border-left:3px solid ${EMAIL_COLORS.primary};background:#f8fafc;border-radius:4px;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:${EMAIL_COLORS.muted};margin-bottom:6px;">Mensagem do remetente</div>
    <div style="font-size:14px;white-space:pre-wrap;">${escapeHtml(trimmed)}</div>
  </div>`;
}
