"use client";
import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Participante = {
  nome: string;
  email: string | null;
};

interface Props {
  items: Participante[];
  onChange: (next: Participante[]) => void;
}

export function ParticipanteList({ items, onChange }: Props) {
  function set(idx: number, partial: Partial<Participante>) {
    const next = items.map((it, i) => (i === idx ? { ...it, ...partial } : it));
    onChange(next);
  }
  function add() {
    onChange([...items, { nome: "", email: null }]);
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((p, idx) => (
        <section key={idx} className="rounded-md border border-[var(--color-border)] bg-white p-4">
          <header className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Participante #{idx + 1}</h3>
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} aria-label="Remover participante">
              <Trash2Icon className="size-4" aria-hidden="true" />
            </Button>
          </header>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`pnome-${idx}`}>Nome</Label>
              <Input id={`pnome-${idx}`} value={p.nome} onChange={(e) => set(idx, { nome: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`pemail-${idx}`}>E-mail (opcional)</Label>
              <Input
                id={`pemail-${idx}`}
                type="email"
                value={p.email ?? ""}
                onChange={(e) => set(idx, { email: e.target.value || null })}
              />
            </div>
          </div>
        </section>
      ))}
      <Button type="button" variant="ghost" onClick={add}>
        <PlusIcon className="size-4" aria-hidden="true" />
        Adicionar participante
      </Button>
    </div>
  );
}
