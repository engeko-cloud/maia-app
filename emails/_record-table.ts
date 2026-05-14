import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";

export type RecordRow = { label: string; value: string | null | undefined };

export function recordTable(rows: RecordRow[]): string {
  const trs = rows.map((r, i) => {
    const border = i < rows.length - 1 ? `border-bottom:1px solid ${EMAIL_COLORS.border};` : "";
    return `<tr style="${border}">
      <td style="width:40%;font-size:12px;color:${EMAIL_COLORS.muted};padding:8px 0;vertical-align:top;">${escapeHtml(r.label)}</td>
      <td style="font-size:14px;padding:8px 0;vertical-align:top;">${escapeHtml(r.value ?? "—")}</td>
    </tr>`;
  }).join("");
  return `<table role="presentation" style="width:100%;border:1px solid ${EMAIL_COLORS.border};border-radius:8px;padding:12px;border-collapse:collapse;">
    <tbody>${trs}</tbody>
  </table>`;
}
