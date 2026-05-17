import * as React from "react";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";
import { investigacaoSituacaoLabel, planoAcaoStatusLabel } from "@/lib/investigacao-state";

interface Props {
  ocorrencia: {
    serial_id: number | null;
    tipo: string;
    data_ocorrencia: string;
    descricao: string | null;
    colaborador_nome: string | null;
    cpf: string | null;
    colaborador_setor: string | null;
    colaborador_cargo: string | null;
    tipo_local: string | null;
    texto_local: string | null;
    atendimento: boolean;
    data_atendimento: string | null;
    hora_atendimento: string | null;
    duracao_afastamento: number | null;
    cid: string | null;
    parecer_medico: string | null;
    internacao: boolean;
    morte: boolean;
    bo: boolean;
    no_bo: string | null;
    empresa_nome: string;
    unidade_nome: string;
    empresa_logo_url?: string | null;
  };
  investigacao: {
    situacao: string;
    dados: InvestigacaoDados;
    decidido_por_nome?: string | null;
    decidido_em?: string | null;
    token_publico: string;
  };
  categoriasById: Record<string, { rotulo: string; codigo: string }>;
  grausById: Record<string, { rotulo: string }>;
  publicReportUrl: string;
  storagePublicBase: string;  // ${SUPABASE_URL}/storage/v1/object/public/attachments/
}

export function InvestigacaoReport({
  ocorrencia, investigacao, categoriasById, grausById, publicReportUrl, storagePublicBase,
}: Props) {
  const { dados } = investigacao;
  const idLabel = ocorrencia.serial_id != null ? `#${ocorrencia.serial_id}` : "—";

  const ishikawaFilled = dados.ishikawa.filter((b) => b.causas.length > 0);

  return (
    <article className="report mx-auto max-w-3xl bg-white p-8 text-[var(--color-fg)] print:p-0">
      {/* 1. Header */}
      <header className="mb-6 border-b border-[var(--color-border)] pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-fg-muted)]">Relatório de investigação</p>
            <h1 className="mt-1 text-2xl font-semibold">{ocorrencia.empresa_nome}</h1>
            <p className="text-sm text-[var(--color-fg-muted)]">{ocorrencia.unidade_nome}</p>
          </div>
          {ocorrencia.empresa_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ocorrencia.empresa_logo_url} alt="" className="h-12 w-auto" />
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div><span className="text-[var(--color-fg-muted)]">Identificador:</span> <strong>{idLabel}</strong></div>
          <div><span className="text-[var(--color-fg-muted)]">Tipo:</span> {ocorrenciaTipoLabel(ocorrencia.tipo)}</div>
          <div><span className="text-[var(--color-fg-muted)]">Data:</span> {new Date(ocorrencia.data_ocorrencia).toLocaleString("pt-BR")}</div>
          <div><span className="text-[var(--color-fg-muted)]">Situação:</span> {investigacaoSituacaoLabel(investigacao.situacao)}</div>
          {investigacao.situacao === "aprovada" && investigacao.decidido_por_nome ? (
            <div><span className="text-[var(--color-fg-muted)]">Aprovada por:</span> {investigacao.decidido_por_nome}{investigacao.decidido_em ? ` em ${new Date(investigacao.decidido_em).toLocaleString("pt-BR")}` : ""}</div>
          ) : null}
        </div>
      </header>

      {/* 2. Resumo da ocorrência */}
      <Section title="Resumo da ocorrência">
        <Fields fields={[
          { label: "Colaborador", value: ocorrencia.colaborador_nome ?? "—" },
          { label: "CPF",         value: ocorrencia.cpf ?? "—" },
          { label: "Setor",       value: ocorrencia.colaborador_setor ?? "—" },
          { label: "Cargo",       value: ocorrencia.colaborador_cargo ?? "—" },
          { label: "Tipo de local", value: ocorrencia.tipo_local ?? "—" },
          { label: "Local",       value: ocorrencia.texto_local ?? "—" },
        ]} />
        {ocorrencia.descricao ? (
          <p className="mt-3 whitespace-pre-wrap text-sm">{ocorrencia.descricao}</p>
        ) : null}
      </Section>

      {/* 3. Atendimento médico (conditional) */}
      {ocorrencia.atendimento ? (
        <Section title="Atendimento médico">
          <Fields fields={[
            { label: "Data",                value: ocorrencia.data_atendimento ?? "—" },
            { label: "Hora",                value: ocorrencia.hora_atendimento ?? "—" },
            { label: "Duração afastamento", value: ocorrencia.duracao_afastamento != null ? `${ocorrencia.duracao_afastamento} dias` : "—" },
            { label: "CID",                 value: ocorrencia.cid ?? "—" },
            { label: "Internação",          value: ocorrencia.internacao ? "Sim" : "Não" },
            { label: "Morte",               value: ocorrencia.morte ? "Sim" : "Não" },
            { label: "BO",                  value: ocorrencia.bo ? `Sim${ocorrencia.no_bo ? ` (${ocorrencia.no_bo})` : ""}` : "Não" },
          ]} />
          {ocorrencia.parecer_medico ? (
            <div className="mt-3">
              <p className="text-xs uppercase text-[var(--color-fg-muted)]">Parecer médico</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{ocorrencia.parecer_medico}</p>
            </div>
          ) : null}
        </Section>
      ) : null}

      {/* 4. Análise Ishikawa */}
      {ishikawaFilled.length > 0 ? (
        <Section title="Análise Ishikawa">
          <div className="grid gap-3 sm:grid-cols-2">
            {ishikawaFilled.map((b) => {
              const cat = categoriasById[b.categoria_id];
              const grau = b.grau_id ? grausById[b.grau_id] : null;
              return (
                <div key={b.categoria_id} className="rounded-md border border-[var(--color-border)] p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{cat?.rotulo ?? "Categoria"}</h3>
                    {grau ? <span className="rounded-md bg-[var(--color-bg-muted)] px-2 py-0.5 text-xs">{grau.rotulo}</span> : null}
                  </div>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {b.causas.map((c, i) => <li key={i}>{c.descricao}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      {/* 5. Plano de ação */}
      {dados.plano_acao.length > 0 ? (
        <Section title="Plano de ação">
          <table className="w-full border-collapse text-sm">
            <thead className="text-left text-xs uppercase text-[var(--color-fg-muted)]">
              <tr>
                <th className="border-b border-[var(--color-border)] py-2 pr-3">Ação</th>
                <th className="border-b border-[var(--color-border)] py-2 pr-3">Responsável</th>
                <th className="border-b border-[var(--color-border)] py-2 pr-3">Prazo</th>
                <th className="border-b border-[var(--color-border)] py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {dados.plano_acao.map((a, i) => (
                <tr key={i}>
                  <td className="border-b border-[var(--color-border)] py-2 pr-3">{a.acao}</td>
                  <td className="border-b border-[var(--color-border)] py-2 pr-3">{a.responsavel}</td>
                  <td className="border-b border-[var(--color-border)] py-2 pr-3">{a.prazo}</td>
                  <td className="border-b border-[var(--color-border)] py-2">{planoAcaoStatusLabel(a.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {/* 6. Participantes */}
      {dados.participantes.length > 0 ? (
        <Section title="Participantes">
          <ul className="text-sm">
            {dados.participantes.map((p, i) => (
              <li key={i} className="border-b border-[var(--color-border)] py-1">
                {p.nome}{p.email ? <span className="text-[var(--color-fg-muted)]"> · {p.email}</span> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* 7. Galeria de fotos */}
      {dados.fotos.length > 0 ? (
        <Section title="Galeria de fotos">
          <div className="grid grid-cols-2 gap-3">
            {dados.fotos.map((f, i) => (
              <figure key={i} className="overflow-hidden rounded-md border border-[var(--color-border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${storagePublicBase}${f.path}`} alt={f.legenda ?? ""} className="w-full" />
                {f.legenda ? <figcaption className="p-2 text-xs text-[var(--color-fg-muted)]">{f.legenda}</figcaption> : null}
              </figure>
            ))}
          </div>
        </Section>
      ) : null}

      {/* 8. Footer */}
      <footer className="mt-8 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-fg-muted)]">
        Relatório gerado em {new Date().toLocaleString("pt-BR")} · Permalink: <span className="font-mono">{publicReportUrl}</span>
      </footer>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">{title}</h2>
      {children}
    </section>
  );
}

function Fields({ fields }: { fields: Array<{ label: string; value: string }> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
      {fields.map((f) => (
        <React.Fragment key={f.label}>
          <dt className="text-[var(--color-fg-muted)]">{f.label}</dt>
          <dd>{f.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
