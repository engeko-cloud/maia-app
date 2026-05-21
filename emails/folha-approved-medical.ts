import { layout } from "./_layout";
import { recordTable } from "./_record-table";
import { mensagemBlock } from "./_mensagem-block";
import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";
import type { AfastamentoEmail } from "./afastamento-receipt";

export function folhaApprovedMedical(data: { a: AfastamentoEmail }): string {
  const { a } = data;
  const body = `
    ${mensagemBlock(a.mensagem)}
    <p style="margin:16px 0;">Aprovação do time de Saúde Ocupacional concluída. Registro enviado ao Fluig.</p>
    ${recordTable([
      { label: "Colaborador", value: `${a.colaborador_nome} (${a.cpf})` },
      { label: "Tipo",        value: a.tipo_rotulo },
      { label: "Período",     value: `${a.data_inicio} → ${a.data_fim ?? "—"}` },
      { label: "CID",         value: a.cid },
      { label: "Empresa",     value: a.empresa_nome },
      { label: "Unidade",     value: a.unidade_nome },
    ])}
    ${a.status_url ? `
    <div style="margin-top:16px;">
      <a href="${escapeHtml(a.status_url)}" style="display:inline-block;background:${EMAIL_COLORS.primary};color:${EMAIL_COLORS.primaryFg};padding:10px 16px;border-radius:6px;text-decoration:none;">Ver detalhes</a>
    </div>` : ""}
  `;
  return layout("Afastamento médico aprovado", body);
}
