"use client";
import { useState } from "react";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_BASE_URL ?? window.location.origin}/update-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Enviamos um email com instruções.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Esqueci a senha</h1>
        <input className="w-full border rounded px-3 py-2" type="email" placeholder="Email"
               value={email} onChange={e => setEmail(e.target.value)} required />
        <button className="w-full bg-primary text-primary-foreground rounded px-3 py-2"
                disabled={loading}>{loading ? "Enviando..." : "Enviar link"}</button>
      </form>
    </main>
  );
}
