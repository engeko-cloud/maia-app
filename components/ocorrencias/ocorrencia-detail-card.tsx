import { FieldGrid, type Field } from "@/components/detail/field-grid";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";
import { fmtDateTime } from "@/lib/fmt-date";

export interface OcorrenciaFull {
  id: string;
  tipo: string;
  situacao: string;
  data_ocorrencia: string;
  email_remetente: string;
  descricao: string;
  criado_em: string;
  empresas: { nome: string } | null;
  unidades: { nome: string } | null;
}

export function OcorrenciaDetailCard({ o }: { o: OcorrenciaFull }) {
  const fields: Field[] = [
    { label: "Tipo",              value: ocorrenciaTipoLabel(o.tipo) },
    { label: "Empresa",           value: o.empresas?.nome ?? "—" },
    { label: "Unidade",           value: o.unidades?.nome ?? "—" },
    { label: "Data da ocorrência", value: fmtDateTime(o.data_ocorrencia), mono: true },
    { label: "Email do remetente", value: o.email_remetente, full: true },
    { label: "Descrição",          value: <p className="whitespace-pre-wrap">{o.descricao}</p>, full: true },
  ];
  return (
    <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
        Dados da ocorrência
      </h2>
      <FieldGrid fields={fields} />
    </section>
  );
}
