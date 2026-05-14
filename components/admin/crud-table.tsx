"use client";

import * as React from "react";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, Trash2Icon, DatabaseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/data/empty-state";

export type Column = {
  key: string;
  label: string;
  type?: "text" | "checkbox" | "number";
  readonly?: boolean;
};

interface AdminCrudTableProps {
  endpoint: string;
  columns: Column[];
  initial: Record<string, unknown>;
  /** Resource label used in Sheet/Dialog copy. Defaults to "registro". */
  resourceLabel?: string;
}

export function AdminCrudTable({
  endpoint,
  columns,
  initial,
  resourceLabel = "registro",
}: AdminCrudTableProps) {
  const [rows, setRows] = React.useState<
    Array<Record<string, unknown> & { id: string }>
  >([]);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState<Record<string, unknown>>(initial);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null
  );
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch(endpoint);
      if (!r.ok) throw new Error(r.statusText);
      const data = await r.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar dados.");
    }
  }, [endpoint]);

  React.useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(initial);
    setFormOpen(true);
  }

  function openEdit(row: Record<string, unknown> & { id: string }) {
    setEditingId(row.id);
    setForm({ ...initial, ...row });
    setFormOpen(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const url = editingId ? `${endpoint}/${editingId}` : endpoint;
    const method = editingId ? "PATCH" : "POST";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!r.ok) {
      setBusy(false);
      const j = await r.json().catch(() => ({}));
      toast.error((j as { error?: string }).error ?? "Erro");
      return;
    }
    toast.success(editingId ? "Atualizado." : "Criado.");
    setFormOpen(false);
    await load();
    setBusy(false);
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    setBusy(true);
    const r = await fetch(`${endpoint}/${confirmDeleteId}`, {
      method: "DELETE",
    });
    if (!r.ok) {
      setBusy(false);
      toast.error("Erro ao excluir.");
      return;
    }
    toast.success("Excluído.");
    setConfirmDeleteId(null);
    await load();
    setBusy(false);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Sheet open={formOpen} onOpenChange={setFormOpen}>
          <SheetTrigger
            render={
              <Button onClick={openCreate}>
                <PlusIcon className="size-4" aria-hidden="true" />
                Novo {resourceLabel}
              </Button>
            }
          />
          <SheetContent>
            <SheetHeader>
              <SheetTitle>
                {editingId ? `Editar ${resourceLabel}` : `Novo ${resourceLabel}`}
              </SheetTitle>
              <SheetDescription>
                Preencha os campos abaixo. Mudanças entram em vigor imediatamente.
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={submitForm} className="flex flex-col gap-4 p-4">
              {columns
                .filter((c) => !c.readonly)
                .map((c) => (
                  <div key={c.key} className="flex flex-col gap-1.5">
                    <Label htmlFor={c.key}>{c.label}</Label>
                    {c.type === "checkbox" ? (
                      <Checkbox
                        id={c.key}
                        checked={Boolean(form[c.key])}
                        onCheckedChange={(v) =>
                          setForm({ ...form, [c.key]: Boolean(v) })
                        }
                      />
                    ) : (
                      <Input
                        id={c.key}
                        type={c.type ?? "text"}
                        value={
                          (form[c.key] as string | number | undefined) ?? ""
                        }
                        onChange={(e) =>
                          setForm({
                            ...form,
                            [c.key]:
                              c.type === "number"
                                ? Number(e.target.value)
                                : e.target.value,
                          })
                        }
                      />
                    )}
                  </div>
                ))}
              <SheetFooter>
                <SheetClose
                  render={
                    <Button variant="outline" type="button">
                      Cancelar
                    </Button>
                  }
                />
                <Button type="submit" disabled={busy}>
                  {editingId ? "Salvar alterações" : "Adicionar"}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={DatabaseIcon}
          title={`Nenhum ${resourceLabel} cadastrado.`}
          hint={`Clique em "Novo ${resourceLabel}" para começar.`}
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--color-bg-subtle)]">
                {columns.map((c) => (
                  <TableHead
                    key={c.key}
                    className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]"
                  >
                    {c.label}
                  </TableHead>
                ))}
                <TableHead className="w-24 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="hover:bg-[var(--color-bg-subtle)]"
                >
                  {columns.map((c) => (
                    <TableCell key={c.key} className="text-sm">
                      {c.type === "checkbox"
                        ? row[c.key]
                          ? "Sim"
                          : "Não"
                        : String(row[c.key] ?? "—")}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(row)}
                        aria-label="Editar"
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteId(row.id)}
                        aria-label="Excluir"
                        className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={Boolean(confirmDeleteId)}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {resourceLabel}?</DialogTitle>
            <DialogDescription>
              Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline">Cancelar</Button>}
            />
            <Button
              onClick={confirmDelete}
              disabled={busy}
              className="bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90"
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
