"use client";
import Link from "next/link";
import { AdminCrudTable } from "@/components/admin/crud-table";

export default function EmpresasPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/app/admin" className="hover:text-foreground">
            Administração
          </Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">
            Empresas
          </span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
      </header>
      <AdminCrudTable
        endpoint="/api/admin/empresas"
        resourceLabel="empresa"
        initial={{
          nome: "",
          razao_social: "",
          cnpj: "",
          codigo_soc: "",
          codigo_fluig: "",
          ativo: true,
        }}
        columns={[
          { key: "nome", label: "Nome" },
          { key: "razao_social", label: "Razão Social" },
          { key: "cnpj", label: "CNPJ" },
          { key: "codigo_soc", label: "Cód SOC" },
          { key: "codigo_fluig", label: "Cód Fluig" },
          { key: "ativo", label: "Ativo", type: "checkbox" },
        ]}
      />
    </div>
  );
}
