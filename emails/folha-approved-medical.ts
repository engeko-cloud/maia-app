import { layout } from "./_layout";
import { recordTable } from "./_record-table";
import type { AfastamentoEmail } from "./afastamento-receipt";

export function folhaApprovedMedical(data: { a: AfastamentoEmail }): string {
  const { a } = data;
  const body = `
    <p style="margin:16px 0;">Aprovação do time de Saúde Ocupacional concluída. Registro enviado ao Fluig.</p>
    ${recordTable([
      { label: "Colaborador", value: `${a.colaborador_nome} (${a.cpf})` },
      { label: "Tipo",        value: a.tipo_rotulo },
      { label: "Período",     value: `${a.data_inicio} → ${a.data_fim ?? "—"}` },
      { label: "CID",         value: a.cid },
      { label: "Empresa",     value: a.empresa_nome },
      { label: "Unidade",     value: a.unidade_nome },
    ])}
  `;
  return layout("Afastamento médico aprovado", body);
}
