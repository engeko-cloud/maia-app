import { FieldGrid, type Field } from "@/components/detail/field-grid";
import { AttachmentChip } from "@/components/detail/attachment-chip";

export interface AfastamentoFull {
  id: string;
  cpf: string;
  colaborador_nome: string;
  colaborador_setor: string | null;
  colaborador_cargo: string | null;
  data_inicio: string;
  data_fim: string | null;
  duracao: number | null;
  cid: string | null;
  emissor: { tipo: string; no: string; uf: string } | null;
  inss: boolean;
  acidente: boolean;
  internacao: boolean;
  email_remetente: string;
  arquivo_url: string | null;
  situacao: string;
  motivo_rejeicao: string | null;
  criado_em: string;
  empresas: { nome: string } | null;
  unidades: { nome: string } | null;
  afastamento_tipos: { rotulo: string } | null;
}

export function AfastamentoDetail({ a }: { a: AfastamentoFull }) {
  const flags = [a.inss && "INSS", a.acidente && "Acidente", a.internacao && "Internação"]
    .filter(Boolean)
    .join(", ");

  const fields: Field[] = [
    { label: "Colaborador",        value: a.colaborador_nome, full: true },
    { label: "CPF",                value: a.cpf, mono: true },
    { label: "Tipo",               value: a.afastamento_tipos?.rotulo ?? "—" },
    { label: "Empresa",            value: a.empresas?.nome ?? "—" },
    { label: "Unidade",            value: a.unidades?.nome ?? "—" },
    { label: "Setor",              value: a.colaborador_setor ?? "—" },
    { label: "Cargo",              value: a.colaborador_cargo ?? "—" },
    { label: "Início",             value: a.data_inicio, mono: true },
    { label: "Fim",                value: a.data_fim ?? "—", mono: true },
    { label: "Duração",            value: a.duracao != null ? `${a.duracao} dia(s)` : "—" },
    { label: "CID",                value: a.cid ?? "—", mono: true },
    { label: "Emissor",            value: a.emissor ? `${a.emissor.tipo} ${a.emissor.no}/${a.emissor.uf}` : "—" },
    { label: "Flags",              value: flags || "—" },
    { label: "Email do remetente", value: a.email_remetente, full: true },
  ];
  if (a.motivo_rejeicao) {
    fields.push({ label: "Motivo da rejeição", value: a.motivo_rejeicao, full: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Dados do afastamento
        </h2>
        <FieldGrid fields={fields} />
      </section>

      {a.arquivo_url && (
        <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
            Anexo
          </h2>
          <AttachmentChip
            href={`/api/public/afastamentos/upload/preview?path=${encodeURIComponent(a.arquivo_url)}`}
            filename={a.arquivo_url.split("/").pop() ?? "anexo"}
          />
        </section>
      )}
    </div>
  );
}
