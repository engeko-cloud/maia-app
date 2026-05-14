"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    router.push("/painel");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Entrar no MAIA</h1>
        <input className="w-full border rounded px-3 py-2" type="email" placeholder="Email"
               value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="w-full border rounded px-3 py-2" type="password" placeholder="Senha"
               value={password} onChange={e => setPassword(e.target.value)} required />
        <button className="w-full bg-primary text-primary-foreground rounded px-3 py-2"
                disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
        <Link href="/forgot-password" className="text-sm text-muted-foreground underline">
          Esqueci a senha
        </Link>
      </form>
    </main>
  );
}
