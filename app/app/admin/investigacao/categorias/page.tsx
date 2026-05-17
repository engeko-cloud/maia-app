"use client";
import Link from "next/link";
import { AdminCrudTable } from "@/components/admin/crud-table";

export default function InvestigacaoCategoriasPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/app/admin" className="hover:text-foreground">Administração</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span className="text-foreground">Investigação</span>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">Categorias</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Categorias de Ishikawa</h1>
      </header>
      <AdminCrudTable
        endpoint="/api/admin/investigacao/categorias"
        resourceLabel="categoria"
        allowCreate={false}
        allowDelete={false}
        initial={{ ordem: 0, ativo: true }}
        columns={[
          { key: "codigo", label: "Código", readonly: true },
          { key: "rotulo", label: "Rótulo", readonly: true },
          { key: "ordem",  label: "Ordem", type: "number" },
          { key: "ativo",  label: "Ativo", type: "checkbox" },
        ]}
      />
    </div>
  );
}
