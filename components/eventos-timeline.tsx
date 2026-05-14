"use client";
import { useEffect, useState } from "react";

const LABELS: Record<string, string> = {
  criado: "Criado", aprovado: "Aprovado", rejeitado: "Rejeitado", resubmetido: "Reenviado",
  cancelado: "Cancelado", fluig_enviado: "Enviado ao Fluig", fluig_erro: "Erro no Fluig",
  email_enviado: "Email enviado",
};

export function EventosTimeline({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [eventos, setEventos] = useState<any[]>([]);
  useEffect(() => {
    fetch(`/api/eventos/${entityType}/${entityId}`).then(r => r.json()).then(setEventos);
  }, [entityType, entityId]);
  if (!eventos.length) return <p className="text-sm text-muted-foreground">Nenhum evento.</p>;
  return (
    <ul className="space-y-2">
      {eventos.map(e => (
        <li key={e.id} className="text-sm border-l-2 border-border pl-3">
          <div className="font-medium">{LABELS[e.evento] ?? e.evento}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(e.ocorrido_em).toLocaleString("pt-BR")} {e.usuarios?.nome ? `· ${e.usuarios.nome}` : ""}
          </div>
        </li>
      ))}
    </ul>
  );
}
