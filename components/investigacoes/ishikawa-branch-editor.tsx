"use client";
import * as React from "react";
import { Trash2Icon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type IshikawaBranch = {
  categoria_id: string;
  grau_id: string | null;
  causas: string[];
};

interface Props {
  branch:    IshikawaBranch;
  categoriaRotulo: string;
  graus:     Array<{ id: string; rotulo: string }>;
  onChange:  (next: IshikawaBranch) => void;
  readOnly?: boolean;
  readOnlyLabel?: string;
}

export function IshikawaBranchEditor({
  branch, categoriaRotulo, graus, onChange, readOnly, readOnlyLabel,
}: Props) {
  function setGrau(id: string) {
    onChange({ ...branch, grau_id: id || null });
  }
  function setCausa(idx: number, text: string) {
    const next = [...branch.causas];
    next[idx] = text;
    onChange({ ...branch, causas: next });
  }
  function addCausa() {
    onChange({ ...branch, causas: [...branch.causas, ""] });
  }
  function removeCausa(idx: number) {
    onChange({ ...branch, causas: branch.causas.filter((_, i) => i !== idx) });
  }

  return (
    <section className="rounded-md border border-[var(--color-border)] bg-white p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{categoriaRotulo}</h3>
        {readOnly ? (
          <span className="text-xs text-[var(--color-fg-muted)]">{readOnlyLabel}</span>
        ) : null}
      </header>

      <div className="mb-3 flex items-center gap-3">
        <Label htmlFor={`grau-${branch.categoria_id}`} className="w-20 shrink-0 text-xs text-[var(--color-fg-muted)]">
          Grau
        </Label>
        <Select
          value={branch.grau_id ?? ""}
          onValueChange={(v) => setGrau(v as string)}
          disabled={readOnly}
        >
          <SelectTrigger id={`grau-${branch.categoria_id}`} className="w-full">
            <SelectValue placeholder="Selecionar grau" />
          </SelectTrigger>
          <SelectContent>
            {graus.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.rotulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ul className="flex flex-col gap-2">
        {branch.causas.map((c, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <Input
              value={c}
              onChange={(e) => setCausa(idx, e.target.value)}
              placeholder="Descreva a causa"
              disabled={readOnly}
            />
            {!readOnly ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeCausa(idx)}
                aria-label="Remover causa"
              >
                <Trash2Icon className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      {!readOnly ? (
        <Button
          type="button"
          variant="ghost"
          className="mt-3"
          onClick={addCausa}
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          Adicionar causa
        </Button>
      ) : null}
    </section>
  );
}
