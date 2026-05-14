"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Column = { key: string; label: string; type?: "text" | "checkbox" | "number"; readonly?: boolean };

export function AdminCrudTable({ endpoint, columns, initial }: {
  endpoint: string;
  columns: Column[];
  initial: Record<string, any>;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState(initial);
  const load = () => fetch(endpoint).then(r => r.json()).then(setRows);
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    if (!r.ok) { const j = await r.json(); toast.error(j.error ?? "Erro"); return; }
    toast.success("Criado.");
    setForm(initial);
    load();
  }

  async function patch(id: string, payload: Record<string, any>) {
    const r = await fetch(`${endpoint}/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!r.ok) { toast.error("Erro"); return; }
    load();
  }

  return (
    <>
      <form onSubmit={create} className="border rounded p-4 mb-6 grid grid-cols-3 gap-2">
        {columns.filter(c => !c.readonly).map(c => (
          c.type === "checkbox"
            ? <label key={c.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!form[c.key]}
                       onChange={e => setForm({ ...form, [c.key]: e.target.checked })} />
                {c.label}
              </label>
            : <input key={c.key} className="border rounded px-2 py-1" placeholder={c.label}
                     type={c.type ?? "text"}
                     value={form[c.key] ?? ""}
                     onChange={e => setForm({ ...form, [c.key]: c.type === "number" ? Number(e.target.value) : e.target.value })} />
        ))}
        <button className="bg-primary text-primary-foreground rounded">Adicionar</button>
      </form>

      <table className="w-full text-sm">
        <thead className="bg-muted/30"><tr>{columns.map(c => <th key={c.key} className="text-left p-2">{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t">
              {columns.map(c => (
                <td key={c.key} className="p-2">
                  {c.type === "checkbox"
                    ? <input type="checkbox" checked={!!r[c.key]} onChange={e => patch(r.id, { [c.key]: e.target.checked })} />
                    : <input className="bg-transparent w-full" value={r[c.key] ?? ""}
                             onBlur={e => e.target.value !== (r[c.key] ?? "") ? patch(r.id, { [c.key]: c.type === "number" ? Number(e.target.value) : e.target.value }) : null}
                             onChange={e => { r[c.key] = e.target.value; setRows([...rows]); }} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
