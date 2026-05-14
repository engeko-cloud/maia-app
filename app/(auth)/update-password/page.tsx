"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Senha atualizada.");
    router.push("/painel");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Definir senha</h1>
        <input className="w-full border rounded px-3 py-2" type="password" placeholder="Nova senha"
               value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
        <button className="w-full bg-primary text-primary-foreground rounded px-3 py-2"
                disabled={loading}>{loading ? "Salvando..." : "Salvar"}</button>
      </form>
    </main>
  );
}
