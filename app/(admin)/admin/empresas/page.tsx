"use client";
import { AdminCrudTable } from "@/components/admin/crud-table";

export default function EmpresasPage() {
  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Empresas</h1>
      <AdminCrudTable
        endpoint="/api/admin/empresas"
        initial={{ nome: "", razao_social: "", cnpj: "", codigo_soc: "", codigo_fluig: "", ativo: true }}
        columns={[
          { key: "nome",         label: "Nome" },
          { key: "razao_social", label: "Razão Social" },
          { key: "cnpj",         label: "CNPJ" },
          { key: "codigo_soc",   label: "Cód SOC" },
          { key: "codigo_fluig", label: "Cód Fluig" },
          { key: "ativo",        label: "Ativo", type: "checkbox" },
        ]}
      />
    </main>
  );
}
