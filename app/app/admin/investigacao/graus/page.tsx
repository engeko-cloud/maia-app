"use client";
import Link from "next/link";
import { AdminCrudTable } from "@/components/admin/crud-table";

export default function InvestigacaoGrausPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/app/admin" className="hover:text-foreground">Administração</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span className="text-foreground">Investigação</span>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">Graus</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Graus de severidade</h1>
      </header>
      <AdminCrudTable
        endpoint="/api/admin/investigacao/graus"
        resourceLabel="grau"
        initial={{ codigo: "", rotulo: "", ordem: 0, ativo: true }}
        columns={[
          { key: "codigo", label: "Código" },
          { key: "rotulo", label: "Rótulo" },
          { key: "ordem",  label: "Ordem", type: "number" },
          { key: "ativo",  label: "Ativo", type: "checkbox" },
        ]}
      />
    </div>
  );
}
