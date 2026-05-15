import { layout } from "./_layout";
import { escapeHtml } from "./_escape";
import { EMAIL_COLORS } from "./tokens";

export type RelatorioEmail = {
  domain: string;
  filterSummary: string;
  rowCount: number;
};

export function relatorioPronto(data: { r: RelatorioEmail }): string {
  const { r } = data;
  const body = `
    <p style="margin:16px 0;">
      Seu relatório de <strong>${escapeHtml(r.domain)}</strong> está pronto e segue em anexo neste e-mail.
    </p>
    <table role="presentation" style="width:100%;border:1px solid ${EMAIL_COLORS.border};border-radius:8px;padding:12px;border-collapse:collapse;">
      <tbody>
        <tr style="border-bottom:1px solid ${EMAIL_COLORS.border};">
          <td style="width:40%;font-size:12px;color:${EMAIL_COLORS.muted};padding:8px 0;vertical-align:top;">Filtros aplicados</td>
          <td style="font-size:14px;padding:8px 0;">${escapeHtml(r.filterSummary || "Nenhum")}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:${EMAIL_COLORS.muted};padding:8px 0;vertical-align:top;">Total de registros</td>
          <td style="font-size:14px;padding:8px 0;">${r.rowCount}</td>
        </tr>
      </tbody>
    </table>
  `;
  return layout(`Relatório de ${r.domain}`, body);
}
