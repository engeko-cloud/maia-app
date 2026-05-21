"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  afastamentoId: string;
  defaultEmail: string | null;
}

export function SendFinalizadoEmailCard({ afastamentoId, defaultEmail }: Props) {
  const router = useRouter();
  const [emails, setEmails] = React.useState(defaultEmail ?? "");
  const [mensagem, setMensagem] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function send() {
    if (!emails.trim()) {
      toast.error("Informe ao menos um destinatário.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/afastamentos/${afastamentoId}/notificar-folha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails,
          mensagem: mensagem.trim() ? mensagem : undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (j.error === "invalid_emails") {
          toast.error(`Emails inválidos: ${(j.invalid as string[]).join(", ")}`);
        } else if (j.error === "too_many_recipients") {
          toast.error(`Máximo de ${j.max} destinatários por envio.`);
        } else if (j.error === "invalid_situacao") {
          toast.error("Afastamento não está finalizado.");
        } else {
          toast.error(j.message ?? "Erro ao enviar.");
        }
        return;
      }
      toast.success(`Email enviado para ${(j.to as string[]).length} destinatário(s).`);
      setMensagem("");
      router.refresh();
    } catch {
      toast.error("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <MailIcon className="size-4 text-[var(--color-fg-muted)]" aria-hidden="true" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Enviar notificação
        </h2>
      </div>
      <p className="mb-4 text-sm text-[var(--color-fg-muted)]">
        Envie o resumo deste afastamento para destinatários adicionais. Cada envio fica
        registrado no histórico.
      </p>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="notif-emails">Destinatários</Label>
          <Textarea
            id="notif-emails"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="folha@empresa.com, gerente@empresa.com"
            rows={2}
            disabled={busy}
          />
          <p className="text-xs text-[var(--color-fg-muted)]">
            Separe por vírgula, ponto-e-vírgula ou espaço. Máximo de 50 destinatários por envio.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="notif-mensagem">Mensagem adicional (opcional)</Label>
          <Textarea
            id="notif-mensagem"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Inclua um contexto ou observação para os destinatários."
            rows={4}
            maxLength={2000}
            disabled={busy}
          />
          <p className="text-xs text-[var(--color-fg-muted)]">
            {mensagem.length}/2000 caracteres.
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={send} disabled={busy}>
            {busy ? "Enviando…" : "Enviar notificação"}
          </Button>
        </div>
      </div>
    </section>
  );
}
