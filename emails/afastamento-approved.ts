import { layout } from "./_layout";
import { recordTable } from "./_record-table";
import type { AfastamentoEmail } from "./afastamento-receipt";

export function afastamentoApproved(data: { a: AfastamentoEmail }): string {
  const { a } = data;
  const body = `
    <p style="margin:16px 0;">Seu registro foi aprovado e processado.</p>
    ${recordTable([
      { label: "Colaborador", value: `${a.colaborador_nome} (${a.cpf})` },
      { label: "Tipo",        value: a.tipo_rotulo },
      { label: "Período",     value: `${a.data_inicio} → ${a.data_fim ?? "—"}` },
      { label: "Situação",    value: "Aprovado" },
    ])}
  `;
  return layout("Afastamento aprovado", body);
}
