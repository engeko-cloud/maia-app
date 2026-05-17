import type { InvestigacaoDados } from "@/lib/investigacao-dados";
import { planoAcaoStatusLabel } from "@/lib/investigacao-state";

interface Categoria { rotulo: string; codigo: string; }
interface Grau { rotulo: string; }

interface InvestigacaoDataViewProps {
  dados: InvestigacaoDados;
  categoriasById: Record<string, Categoria>;
  grausById: Record<string, Grau>;
  storagePublicBase: string;
}

export function InvestigacaoDataView({
  dados, categoriasById, grausById, storagePublicBase,
}: InvestigacaoDataViewProps) {
  const ishikawaFilled = dados.ishikawa.filter((b) => b.causas.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Análise Ishikawa
        </h3>
        {ishikawaFilled.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">Nenhuma causa registrada.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {ishikawaFilled.map((b) => {
              const cat = categoriasById[b.categoria_id];
              const grau = b.grau_id ? grausById[b.grau_id] : null;
              return (
                <div key={b.categoria_id} className="rounded-md border border-[var(--color-border)] p-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{cat?.rotulo ?? "Categoria"}</h4>
                    {grau ? (
                      <span className="rounded-md bg-[var(--color-bg-muted)] px-2 py-0.5 text-xs">
                        {grau.rotulo}
                      </span>
                    ) : null}
                  </div>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {b.causas.map((c, i) => <li key={i}>{c.descricao}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Plano de ação
        </h3>
        {dados.plano_acao.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">Nenhum item no plano de ação.</p>
        ) : (
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
                  <td className="border-b border-[var(--color-border)] py-2 pr-3 font-mono">{a.prazo}</td>
                  <td className="border-b border-[var(--color-border)] py-2">{planoAcaoStatusLabel(a.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Participantes
        </h3>
        {dados.participantes.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">Nenhum participante.</p>
        ) : (
          <ul className="text-sm">
            {dados.participantes.map((p, i) => (
              <li key={i} className="border-b border-[var(--color-border)] py-1">
                {p.nome}
                {p.email ? <span className="text-[var(--color-fg-muted)]"> · {p.email}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Fotos
        </h3>
        {dados.fotos.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">Nenhuma foto.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {dados.fotos.map((f, i) => (
              <figure key={i} className="overflow-hidden rounded-md border border-[var(--color-border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${storagePublicBase}${f.path}`} alt={f.legenda ?? ""} className="w-full" />
                {f.legenda ? (
                  <figcaption className="p-2 text-xs text-[var(--color-fg-muted)]">{f.legenda}</figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
