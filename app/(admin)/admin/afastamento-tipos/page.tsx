"use client";
import Link from "next/link";
import { AdminCrudTable } from "@/components/admin/crud-table";

export default function AfastamentoTiposPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/admin" className="hover:text-foreground">
            Administração
          </Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">
            Tipos de afastamento
          </span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tipos de afastamento
        </h1>
      </header>
      <AdminCrudTable
        endpoint="/api/admin/afastamento-tipos"
        resourceLabel="tipo"
        initial={{
          codigo: "",
          rotulo: "",
          requer_aprovacao: false,
          ordem: 0,
          ativo: true,
        }}
        columns={[
          { key: "codigo", label: "Código" },
          { key: "rotulo", label: "Rótulo" },
          { key: "requer_aprovacao", label: "Requer aprovação", type: "checkbox" },
          { key: "ordem", label: "Ordem", type: "number" },
          { key: "ativo", label: "Ativo", type: "checkbox" },
        ]}
      />
    </div>
  );
}
