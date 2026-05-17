"use client";
import * as React from "react";
import Link from "next/link";
import { AdminCrudTable, type ColumnOption } from "@/components/admin/crud-table";

interface Categoria { id: string; rotulo: string; ativo: boolean }

export default function InvestigacaoCausasPage() {
  const [categoriaOptions, setCategoriaOptions] = React.useState<ColumnOption[]>([]);

  React.useEffect(() => {
    (async () => {
      const r = await fetch("/api/admin/investigacao/categorias");
      if (!r.ok) return;
      const data = (await r.json()) as Categoria[];
      setCategoriaOptions(
        data.filter((c) => c.ativo).map((c) => ({ value: c.id, label: c.rotulo })),
      );
    })();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/app/admin" className="hover:text-foreground">Administração</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span className="text-foreground">Investigação</span>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">Causas</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Causas da Ishikawa</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Biblioteca de causas sugeridas no formulário de investigação, organizadas por categoria.
        </p>
      </header>

      {categoriaOptions.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)]">Carregando categorias…</p>
      ) : (
        <AdminCrudTable
          endpoint="/api/admin/investigacao/causas"
          resourceLabel="causa"
          initial={{ categoria_id: "", texto: "", ordem: 0, ativo: true }}
          columns={[
            { key: "categoria_id", label: "Categoria", type: "select", options: categoriaOptions },
            { key: "texto",        label: "Texto" },
            { key: "ordem",        label: "Ordem", type: "number" },
            { key: "ativo",        label: "Ativo", type: "checkbox" },
          ]}
        />
      )}
    </div>
  );
}
