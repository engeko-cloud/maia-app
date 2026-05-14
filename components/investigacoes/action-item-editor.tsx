"use client";
import * as React from "react";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PLANO_ACAO_STATUS, planoAcaoStatusLabel } from "@/lib/investigacao-state";

export type ActionItem = {
  acao: string;
  responsavel: string;
  prazo: string;
  status: typeof PLANO_ACAO_STATUS[number];
};

interface Props {
  item:    ActionItem;
  index:   number;
  onChange:(next: ActionItem) => void;
  onRemove:() => void;
}

export function ActionItemEditor({ item, index, onChange, onRemove }: Props) {
  function set<K extends keyof ActionItem>(key: K, value: ActionItem[K]) {
    onChange({ ...item, [key]: value });
  }

  return (
    <section className="rounded-md border border-[var(--color-border)] bg-white p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Ação #{index + 1}</h3>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remover ação">
          <Trash2Icon className="size-4" aria-hidden="true" />
        </Button>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`acao-${index}`}>Ação</Label>
          <Input id={`acao-${index}`} value={item.acao} onChange={(e) => set("acao", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`resp-${index}`}>Responsável</Label>
          <Input id={`resp-${index}`} value={item.responsavel} onChange={(e) => set("responsavel", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`prazo-${index}`}>Prazo</Label>
          <Input id={`prazo-${index}`} type="date" value={item.prazo} onChange={(e) => set("prazo", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`status-${index}`}>Status</Label>
          <Select
            value={item.status}
            onValueChange={(v) => set("status", v as ActionItem["status"])}
          >
            <SelectTrigger id={`status-${index}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLANO_ACAO_STATUS.map((s) => (
                <SelectItem key={s} value={s}>{planoAcaoStatusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}
