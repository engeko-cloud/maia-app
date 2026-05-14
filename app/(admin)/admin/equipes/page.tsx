"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function EquipesPage() {
  const [equipes, setEquipes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const load = async () => {
    const [eRes, uRes] = await Promise.all([
      fetch("/api/admin/equipes").then(r => r.json()),
      fetch("/api/admin/usuarios").then(r => r.json()),
    ]);
    setEquipes(eRes); setUsuarios(uRes);
  };
  useEffect(() => { load(); }, []);

  async function add(equipeId: string, usuarioId: string) {
    const r = await fetch(`/api/admin/equipes/${equipeId}/membros`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario_id: usuarioId }),
    });
    if (!r.ok) toast.error("Erro ao adicionar");
    load();
  }
  async function remove(equipeId: string, usuarioId: string) {
    await fetch(`/api/admin/equipes/${equipeId}/membros?usuario_id=${usuarioId}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Equipes</h1>
      {equipes.map(e => (
        <section key={e.id} className="border rounded p-4 mb-4">
          <h2 className="font-semibold">{e.nome} <span className="text-xs text-muted-foreground">({e.codigo})</span></h2>
          <ul className="mt-2 space-y-1">
            {(e.equipe_usuarios ?? []).map((m: any) => (
              <li key={m.usuario_id} className="flex justify-between text-sm">
                <span>{m.usuarios?.nome} ({m.usuarios?.email})</span>
                <button className="text-[var(--color-danger)]" onClick={() => remove(e.id, m.usuario_id)}>Remover</button>
              </li>
            ))}
          </ul>
          <select className="mt-3 border rounded px-2 py-1" onChange={ev => { if (ev.target.value) { add(e.id, ev.target.value); ev.target.value = ""; }}}>
            <option value="">Adicionar membro...</option>
            {usuarios.filter(u => !(e.equipe_usuarios ?? []).some((m: any) => m.usuario_id === u.id))
              .map(u => <option key={u.id} value={u.id}>{u.nome} ({u.email})</option>)}
          </select>
        </section>
      ))}
    </main>
  );
}
