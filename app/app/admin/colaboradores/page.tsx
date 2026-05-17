"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

type Colaborador = {
  cpf: string;
  email: string | null;
  auth_id: string | null;
  criado_em: string;
};

const ENDPOINT = "/api/admin/colaboradores";

export default function ColaboradoresPage() {
  const [rows, setRows] = React.useState<Colaborador[]>([]);
  const [formOpen, setFormOpen] = React.useState(false);
  const [confirmDeleteCpf, setConfirmDeleteCpf] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ cpf: "", email: "" });
  const [addBusy, setAddBusy] = React.useState(false);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch(ENDPOINT);
      if (!r.ok) {
        toast.error("Erro ao carregar colaboradores.");
        return;
      }
      setRows(await r.json());
    } catch {
      toast.error("Erro ao carregar colaboradores.");
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddBusy(true);
    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: form.cpf.trim(), email: form.email.trim() || null }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error((j as { error?: string }).error ?? "Erro");
        return;
      }
      toast.success("Colaborador adicionado.");
      setFormOpen(false);
      setForm({ cpf: "", email: "" });
      await load();
    } finally {
      setAddBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirmDeleteCpf) return;
    setDeleteBusy(true);
    try {
      const r = await fetch(`${ENDPOINT}/${encodeURIComponent(confirmDeleteCpf)}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        toast.error("Erro ao remover colaborador.");
        return;
      }
      toast.success("Colaborador removido.");
      setConfirmDeleteCpf(null);
      await load();
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/admin" className="hover:text-foreground">
            Administração
          </Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">
            Colaboradores
          </span>
        </nav>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Colaboradores</h1>
            <p className="text-sm text-[var(--color-fg-muted)]">
              CPFs pré-cadastrados para acesso ao portal do colaborador.
            </p>
          </div>
          <Sheet open={formOpen} onOpenChange={setFormOpen}>
            <SheetTrigger
              render={
                <Button size="sm" onClick={() => setForm({ cpf: "", email: "" })}>
                  <PlusIcon className="mr-1 size-4" aria-hidden="true" />
                  Adicionar
                </Button>
              }
            />
            <SheetContent>
              <form onSubmit={handleAdd} className="flex flex-col gap-4">
                <SheetHeader>
                  <SheetTitle>Novo colaborador</SheetTitle>
                  <SheetDescription>
                    Registre o CPF. O email é opcional — se informado, será obrigatório no login.
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cpf-input">CPF (somente números)</Label>
                  <Input
                    id="cpf-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={11}
                    value={form.cpf}
                    onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))}
                    required
                    pattern="\d{11}"
                    title="Exatamente 11 dígitos"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email-input">Email (opcional)</Label>
                  <Input
                    id="email-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <SheetFooter>
                  <SheetClose render={<Button type="button" variant="outline">Cancelar</Button>} />
                  <Button type="submit" disabled={addBusy}>
                    {addBusy ? "Salvando…" : "Salvar"}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState title="Nenhum colaborador cadastrado." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CPF</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.cpf}>
                <TableCell className="font-mono text-sm">{row.cpf}</TableCell>
                <TableCell>
                  {row.email ?? (
                    <span className="text-[var(--color-fg-subtle)]">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {row.auth_id ? (
                    <Badge variant="default">Vinculado</Badge>
                  ) : (
                    <Badge variant="secondary">Pendente</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    aria-label={`Remover colaborador ${row.cpf}`}
                    className="text-[var(--color-fg-muted)] hover:text-destructive"
                    onClick={() => setConfirmDeleteCpf(row.cpf)}
                  >
                    <Trash2Icon className="size-4" aria-hidden="true" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={!!confirmDeleteCpf}
        onOpenChange={(open) => !open && setConfirmDeleteCpf(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover colaborador?</DialogTitle>
            <DialogDescription>
              O CPF <span className="font-mono">{confirmDeleteCpf}</span> será removido. Se
              vinculado a uma conta, o acesso ao portal será revogado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancelar</Button>} />
            <Button variant="destructive" disabled={deleteBusy} onClick={handleDelete}>
              {deleteBusy ? "Removendo…" : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
