"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function ConfiguracoesPage() {
  const [emailFolha, setEmailFolha] = useState("");
  useEffect(() => {
    fetch("/api/admin/configuracoes").then(r => r.json()).then(c => setEmailFolha(c?.email_folha ?? ""));
  }, []);
  async function save() {
    const r = await fetch("/api/admin/configuracoes", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email_folha: emailFolha }),
    });
    if (!r.ok) toast.error("Erro"); else toast.success("Salvo.");
  }
  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Configurações</h1>
      <label className="block">
        <span>Email da Folha de Pagamentos</span>
        <input className="w-full border rounded px-3 py-2" value={emailFolha} onChange={e => setEmailFolha(e.target.value)} />
      </label>
      <button onClick={save} className="bg-primary text-primary-foreground rounded px-3 py-2">Salvar</button>
    </main>
  );
}
