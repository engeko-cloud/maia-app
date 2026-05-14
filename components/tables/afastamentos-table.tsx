"use client";
import Link from "next/link";

export function AfastamentosTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <p className="text-muted-foreground p-6">Nenhum registro.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/30">
        <tr>
          <th className="text-left p-2">Colaborador</th>
          <th className="text-left p-2">Tipo</th>
          <th className="text-left p-2">Período</th>
          <th className="text-left p-2">Situação</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id} className="border-t hover:bg-muted/20">
            <td className="p-2">
              <Link href={`/afastamentos/${r.id}`} className="text-primary underline">
                {r.colaborador_nome}
              </Link>
              <div className="text-xs text-muted-foreground">{r.cpf}</div>
            </td>
            <td className="p-2">{r.afastamento_tipos?.rotulo}</td>
            <td className="p-2">{r.data_inicio} → {r.data_fim ?? "—"}</td>
            <td className="p-2">{r.situacao}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
