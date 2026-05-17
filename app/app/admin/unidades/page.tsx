"use client";
import Link from "next/link";
import { AdminCrudTable } from "@/components/admin/crud-table";

export default function UnidadesPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/admin" className="hover:text-foreground">
            Administração
          </Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">
            Unidades
          </span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Unidades</h1>
      </header>
      <AdminCrudTable
        endpoint="/api/admin/unidades"
        resourceLabel="unidade"
        initial={{ codigo: "", nome: "", ativo: true }}
        columns={[
          { key: "codigo", label: "Código" },
          { key: "nome", label: "Nome" },
          { key: "ativo", label: "Ativo", type: "checkbox" },
        ]}
      />
    </div>
  );
}
