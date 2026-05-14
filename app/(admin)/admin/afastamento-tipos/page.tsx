"use client";
import { AdminCrudTable } from "@/components/admin/crud-table";
export default function AfastamentoTiposPage() {
  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Tipos de Afastamento</h1>
      <AdminCrudTable
        endpoint="/api/admin/afastamento-tipos"
        initial={{ codigo: "", rotulo: "", requer_aprovacao: false, ordem: 0, ativo: true }}
        columns={[
          { key: "codigo",           label: "Código" },
          { key: "rotulo",           label: "Rótulo" },
          { key: "requer_aprovacao", label: "Requer aprovação", type: "checkbox" },
          { key: "ordem",            label: "Ordem", type: "number" },
          { key: "ativo",            label: "Ativo", type: "checkbox" },
        ]}
      />
    </main>
  );
}
