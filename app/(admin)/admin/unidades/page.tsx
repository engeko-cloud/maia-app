"use client";
import { AdminCrudTable } from "@/components/admin/crud-table";
export default function UnidadesPage() {
  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Unidades</h1>
      <AdminCrudTable
        endpoint="/api/admin/unidades"
        initial={{ codigo: "", nome: "", ativo: true }}
        columns={[
          { key: "codigo", label: "Código" },
          { key: "nome",   label: "Nome" },
          { key: "ativo",  label: "Ativo", type: "checkbox" },
        ]}
      />
    </main>
  );
}
