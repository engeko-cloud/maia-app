"use client";
import { useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { AfastamentoDetail } from "./afastamento-detail";
import { AprovarRejeitarActions } from "./aprovar-rejeitar-actions";

export function AprovacoesPanel({ pendentes }: { pendentes: any[] }) {
  const [selectedId, setSelectedId] = useState(pendentes[0]?.id);
  const selected = pendentes.find(p => p.id === selectedId);

  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-[calc(100vh-4rem)]">
      <ResizablePanel defaultSize={30} minSize={20}>
        <ul className="divide-y">
          {pendentes.map(p => (
            <li key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`p-3 cursor-pointer ${p.id === selectedId ? "bg-muted" : ""}`}>
              <div className="font-medium">{p.colaborador_nome}</div>
              <div className="text-xs text-muted-foreground">
                {p.cpf} · {p.data_inicio} · {p.tipo_codigo}
              </div>
            </li>
          ))}
          {!pendentes.length && <li className="p-6 text-muted-foreground">Sem pendências.</li>}
        </ul>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={70}>
        {selected ? (
          <div className="p-6 grid grid-cols-[1fr_280px] gap-6">
            <AfastamentoDetail a={selected} />
            <AprovarRejeitarActions id={selected.id} />
          </div>
        ) : <div className="p-6 text-muted-foreground">Selecione uma pendência.</div>}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
