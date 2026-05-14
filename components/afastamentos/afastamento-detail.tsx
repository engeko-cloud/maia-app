type Afastamento = {
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
  inss: boolean; acidente: boolean; internacao: boolean;
  email_remetente: string;
  arquivo_url: string | null;
  situacao: string;
  motivo_rejeicao: string | null;
  criado_em: string;
};

export function AfastamentoDetail({ a }: { a: Afastamento }) {
  return (
    <div className="space-y-2 text-sm">
      <Row k="Colaborador"  v={`${a.colaborador_nome} (${a.cpf})`} />
      <Row k="Setor / Cargo" v={`${a.colaborador_setor ?? "—"} / ${a.colaborador_cargo ?? "—"}`} />
      <Row k="Período"      v={`${a.data_inicio} → ${a.data_fim ?? "—"} (${a.duracao ?? "?"}d)`} />
      <Row k="CID"          v={a.cid ?? "—"} />
      <Row k="Emissor"      v={a.emissor ? `${a.emissor.tipo} ${a.emissor.no}/${a.emissor.uf}` : "—"} />
      <Row k="Flags"        v={[a.inss && "INSS", a.acidente && "Acidente", a.internacao && "Internação"].filter(Boolean).join(", ") || "—"} />
      <Row k="Submetido por" v={a.email_remetente} />
      <Row k="Situação"     v={a.situacao} />
      {a.motivo_rejeicao && <Row k="Motivo rejeição" v={a.motivo_rejeicao} />}
      {a.arquivo_url && (
        <div><a href={`/api/public/afastamentos/upload/preview?path=${encodeURIComponent(a.arquivo_url)}`}
                className="text-primary underline">Ver anexo</a></div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="grid grid-cols-3"><span className="text-muted-foreground">{k}</span><span className="col-span-2">{v}</span></div>;
}
