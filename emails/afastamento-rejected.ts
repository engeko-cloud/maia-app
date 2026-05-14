import { layout } from "./_layout";
import { recordTable } from "./_record-table";
import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";
import type { AfastamentoEmail } from "./afastamento-receipt";

export function afastamentoRejected(data: { a: AfastamentoEmail; motivo: string; editUrl: string }): string {
  const { a, motivo, editUrl } = data;
  const body = `
    <p style="margin:16px 0;">Seu registro precisa de correções:</p>
    <div style="background:${EMAIL_COLORS.dangerBg};padding:12px;border-radius:8px;margin-bottom:12px;">
      <p style="margin:0;">${escapeHtml(motivo)}</p>
    </div>
    ${recordTable([
      { label: "Colaborador", value: `${a.colaborador_nome} (${a.cpf})` },
      { label: "Tipo",        value: a.tipo_rotulo },
      { label: "Período",     value: `${a.data_inicio} → ${a.data_fim ?? "—"}` },
    ])}
    <div style="margin-top:16px;">
      <a href="${escapeHtml(editUrl)}" style="display:inline-block;background:${EMAIL_COLORS.primary};color:${EMAIL_COLORS.primaryFg};padding:10px 16px;border-radius:6px;text-decoration:none;">Corrigir e reenviar</a>
    </div>
  `;
  return layout("Afastamento rejeitado", body);
}
