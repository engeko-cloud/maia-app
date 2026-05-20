"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

interface Usuario {
  id: string;
  email: string;
  nome: string | null;
  sobrenome: string | null;
  administrador: boolean;
  ativo: boolean;
}

export default function UsuariosPage() {
  const [rows, setRows] = React.useState<Usuario[]>([]);
  const [form, setForm] = React.useState({ email: "", nome: "", sobrenome: "", administrador: false });
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch("/api/admin/usuarios");
      if (!r.ok) throw new Error(r.statusText);
      const data = await r.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar usuários.");
    }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error((j as { error?: string }).error ?? "Erro");
        return;
      }
      toast.success("Convite enviado.");
      setForm({ email: "", nome: "", sobrenome: "", administrador: false });
      setOpen(false);
      await load();
    } catch {
      toast.error("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser() {
    if (!confirmDeleteId) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/usuarios/${confirmDeleteId}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({})) as { error?: string; warning?: string };
      if (!r.ok) {
        toast.error(j.error ?? "Erro ao excluir.");
        return;
      }
      if (j.warning) toast.warning(j.warning);
      else toast.success("Usuário excluído.");
      setConfirmDeleteId(null);
      await load();
    } catch {
      toast.error("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, field: "administrador" | "ativo", value: boolean) {
    try {
      const r = await fetch(`/api/admin/usuarios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!r.ok) {
        toast.error("Erro ao atualizar.");
        return;
      }
      load();
    } catch {
      toast.error("Erro de rede.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div className="flex flex-col">
          <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
            <Link href="/app/admin" className="hover:text-foreground">Administração</Link>
            <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
            <span aria-current="page" className="text-foreground">Usuários</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
          <p className="text-sm text-[var(--color-fg-muted)]">{rows.length} usuário{rows.length === 1 ? "" : "s"}</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button><PlusIcon className="size-4" aria-hidden="true" />Convidar usuário</Button>} />
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Convidar usuário</SheetTitle>
              <SheetDescription>O usuário receberá um email para definir senha e ativar a conta.</SheetDescription>
            </SheetHeader>
            <form onSubmit={invite} className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sobrenome">Sobrenome</Label>
                <Input id="sobrenome" value={form.sobrenome} onChange={(e) => setForm({ ...form, sobrenome: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="admin" checked={form.administrador} onCheckedChange={(v) => setForm({ ...form, administrador: Boolean(v) })} />
                <Label htmlFor="admin">Administrador</Label>
              </div>
              <SheetFooter>
                <SheetClose render={<Button type="button" variant="outline">Cancelar</Button>} />
                <Button type="submit" disabled={busy}>Enviar convite</Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </header>

      {rows.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Nenhum usuário cadastrado." hint="Convide o primeiro usuário para começar." />
      ) : (
        <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--color-bg-subtle)]">
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">Nome</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">Email</TableHead>
                <TableHead className="w-20 text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">Admin</TableHead>
                <TableHead className="w-20 text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">Ativo</TableHead>
                <TableHead className="w-16 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-[var(--color-bg-subtle)]">
                  <TableCell className="text-sm">{[r.nome, r.sobrenome].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell className="text-sm font-mono">{r.email}</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={r.administrador}
                      onCheckedChange={(v) => toggle(r.id, "administrador", Boolean(v))}
                      aria-label={`Administrador: ${r.nome ?? r.email}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={r.ativo}
                      onCheckedChange={(v) => toggle(r.id, "ativo", Boolean(v))}
                      aria-label={`Ativo: ${r.nome ?? r.email}`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {!r.administrador && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteId(r.id)}
                        aria-label="Excluir usuário"
                        className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    )}
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
            <DialogTitle>Excluir usuário?</DialogTitle>
            <DialogDescription>
              Essa ação não pode ser desfeita. O usuário perderá o acesso ao sistema.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancelar</Button>} />
            <Button
              onClick={deleteUser}
              disabled={busy}
              className="bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90"
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
