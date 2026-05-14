"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function UsuariosPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ email: "", nome: "", sobrenome: "", administrador: false });
  const load = () => fetch("/api/admin/usuarios").then(r => r.json()).then(setRows);
  useEffect(() => { load(); }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/usuarios", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    if (!r.ok) { const j = await r.json(); toast.error(j.error); return; }
    toast.success("Convite enviado.");
    setForm({ email: "", nome: "", sobrenome: "", administrador: false });
    load();
  }

  async function toggle(id: string, field: "administrador" | "ativo", value: boolean) {
    await fetch(`/api/admin/usuarios/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }),
    });
    load();
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Usuários</h1>
      <form onSubmit={invite} className="border rounded p-4 mb-6 grid grid-cols-4 gap-2">
        <input className="border rounded px-2 py-1" placeholder="Email" type="email"
               value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
        <input className="border rounded px-2 py-1" placeholder="Nome"
               value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
        <input className="border rounded px-2 py-1" placeholder="Sobrenome"
               value={form.sobrenome} onChange={e => setForm({ ...form, sobrenome: e.target.value })} />
        <button className="bg-primary text-primary-foreground rounded">Convidar</button>
      </form>

      <table className="w-full text-sm">
        <thead className="bg-muted/30"><tr>
          <th className="text-left p-2">Nome</th><th className="text-left p-2">Email</th>
          <th>Admin</th><th>Ativo</th>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.nome} {r.sobrenome}</td>
              <td className="p-2">{r.email}</td>
              <td className="text-center"><input type="checkbox" checked={r.administrador}
                  onChange={e => toggle(r.id, "administrador", e.target.checked)} /></td>
              <td className="text-center"><input type="checkbox" checked={r.ativo}
                  onChange={e => toggle(r.id, "ativo", e.target.checked)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
