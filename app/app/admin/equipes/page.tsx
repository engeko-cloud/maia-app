"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Membro {
  usuario_id: string;
  usuarios: { nome: string | null; email: string } | null;
}
interface Equipe {
  id: string;
  codigo: string;
  nome: string;
  equipe_usuarios: Membro[] | null;
}
interface Usuario {
  id: string;
  email: string;
  nome: string | null;
}

export default function EquipesPage() {
  const [equipes, setEquipes] = React.useState<Equipe[]>([]);
  const [usuarios, setUsuarios] = React.useState<Usuario[]>([]);

  const load = React.useCallback(async () => {
    try {
      const [er, ur] = await Promise.all([
        fetch("/api/admin/equipes"),
        fetch("/api/admin/usuarios"),
      ]);
      if (!er.ok || !ur.ok) throw new Error("load");
      const [e, u] = await Promise.all([er.json(), ur.json()]);
      setEquipes(Array.isArray(e) ? e : []);
      setUsuarios(Array.isArray(u) ? u : []);
    } catch {
      toast.error("Erro ao carregar equipes.");
    }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function add(equipeId: string, usuarioId: string) {
    try {
      const r = await fetch(`/api/admin/equipes/${equipeId}/membros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: usuarioId }),
      });
      if (!r.ok) {
        toast.error("Erro ao adicionar.");
        return;
      }
      load();
    } catch {
      toast.error("Erro de rede.");
    }
  }

  async function remove(equipeId: string, usuarioId: string) {
    try {
      const r = await fetch(`/api/admin/equipes/${equipeId}/membros?usuario_id=${usuarioId}`, { method: "DELETE" });
      if (!r.ok) {
        toast.error("Erro ao remover.");
        return;
      }
      load();
    } catch {
      toast.error("Erro de rede.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/admin" className="hover:text-foreground">Administração</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">Equipes</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Equipes</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">Gerencie a composição de cada equipe operacional.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {equipes.map((e) => {
          const membros = e.equipe_usuarios ?? [];
          const disponíveis = usuarios.filter((u) => !membros.some((m) => m.usuario_id === u.id));
          return (
            <section
              key={e.id}
              className="rounded-md border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-xs)]"
            >
              <header className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{e.nome}</h2>
                  <p className="font-mono text-xs text-[var(--color-fg-muted)]">{e.codigo}</p>
                </div>
                <span className="text-xs text-[var(--color-fg-muted)]">
                  {membros.length} membro{membros.length === 1 ? "" : "s"}
                </span>
              </header>
              <ul className="mb-3 flex flex-col divide-y divide-[var(--color-border)]">
                {membros.map((m) => (
                  <li key={m.usuario_id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      <span className="font-medium">{m.usuarios?.nome ?? "—"}</span>
                      <span className="ml-2 font-mono text-xs text-[var(--color-fg-muted)]">{m.usuarios?.email}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Remover membro"
                      onClick={() => remove(e.id, m.usuario_id)}
                      className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </li>
                ))}
                {membros.length === 0 && (
                  <li className="py-3 text-sm text-[var(--color-fg-muted)]">Sem membros ainda.</li>
                )}
              </ul>
              <Select
                value=""
                onValueChange={(v) => { if (v) add(e.id, v as string); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Adicionar membro…" />
                </SelectTrigger>
                <SelectContent>
                  {disponíveis.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          );
        })}
      </div>
    </div>
  );
}
