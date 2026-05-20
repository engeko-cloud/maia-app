"use client";
import * as React from "react";
import { Trash2Icon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type IshikawaBranch = {
  categoria_id: string;
  grau_id: string | null;
  causas: Array<{ causa_id?: string; descricao: string }>;
};

interface Props {
  branch:           IshikawaBranch;
  categoriaRotulo:  string;
  graus:            Array<{ id: string; rotulo: string }>;
  causas:           Array<{ id: string; texto: string }>;
  onChange:         (next: IshikawaBranch) => void;
  readOnly?:        boolean;
  readOnlyLabel?:   string;
}

export function IshikawaBranchEditor({
  branch, categoriaRotulo, graus, causas, onChange, readOnly, readOnlyLabel,
}: Props) {
  const grauLabel = React.useCallback(
    (id: string | null) => (id ? graus.find((g) => g.id === id)?.rotulo ?? null : null),
    [graus],
  );
  const causaLabel = React.useCallback(
    (id: string | undefined) => (id ? causas.find((c) => c.id === id)?.texto ?? null : null),
    [causas],
  );

  function setGrau(id: string) {
    onChange({ ...branch, grau_id: id || null });
  }
  function setCausa(idx: number, libraryId: string) {
    const lib = causas.find((c) => c.id === libraryId);
    if (!lib) return;
    const next = [...branch.causas];
    next[idx] = { causa_id: lib.id, descricao: lib.texto };
    onChange({ ...branch, causas: next });
  }
  function addCausa() {
    onChange({ ...branch, causas: [...branch.causas, { descricao: "" }] });
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
            <SelectValue placeholder="Selecionar grau">
              {(value: string | null) => grauLabel(value) ?? "Selecionar grau"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {graus.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.rotulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ul className="flex flex-col gap-3">
        {branch.causas.map((c, idx) => (
          <li key={idx} className="flex items-center gap-2 rounded-md border border-[var(--color-border)] p-3">
            <Select
              value={c.causa_id ?? ""}
              onValueChange={(libraryId) => setCausa(idx, libraryId as string)}
              disabled={readOnly || causas.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={causas.length === 0 ? "Sem causas na biblioteca" : "Selecionar causa…"}>
                  {(value: string | undefined) => causaLabel(value) ?? (causas.length === 0 ? "Sem causas na biblioteca" : "Selecionar causa…")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {causas.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>{cc.texto}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          disabled={causas.length === 0}
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          Adicionar causa
        </Button>
      ) : null}
    </section>
  );
}
