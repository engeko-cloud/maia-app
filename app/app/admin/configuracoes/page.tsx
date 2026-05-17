"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ConfiguracoesPage() {
  const [emailFolha, setEmailFolha] = React.useState("");
  const [portalSaudacao, setPortalSaudacao] = React.useState("");
  const [portalVazio, setPortalVazio] = React.useState("");
  const [portalBanner, setPortalBanner] = React.useState("");
  const [aprovacaoLentaHoras, setAprovacaoLentaHoras] = React.useState<number>(48);
  const [busy, setBusy] = React.useState(false);
  const [busyDash, setBusyDash] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/admin/configuracoes")
      .then((r) => r.ok ? r.json() : null)
      .then((c) => {
        setEmailFolha(c?.email_folha ?? "");
        setPortalSaudacao(c?.portal_saudacao ?? "");
        setPortalVazio(c?.portal_vazio ?? "");
        setPortalBanner(c?.portal_banner ?? "");
        setAprovacaoLentaHoras(c?.aprovacao_lenta_horas ?? 48);
      })
      .catch(() => toast.error("Erro ao carregar configurações."));
  }, []);

  async function save() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/configuracoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_folha: emailFolha,
          portal_saudacao: portalSaudacao,
          portal_vazio: portalVazio,
          portal_banner: portalBanner,
        }),
      });
      if (!r.ok) {
        toast.error("Erro ao salvar.");
        return;
      }
      toast.success("Salvo.");
    } catch {
      toast.error("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDash() {
    setBusyDash(true);
    try {
      const r = await fetch("/api/admin/configuracoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aprovacao_lenta_horas: aprovacaoLentaHoras }),
      });
      if (!r.ok) {
        toast.error("Erro ao salvar.");
        return;
      }
      toast.success("Salvo.");
    } catch {
      toast.error("Erro de rede.");
    } finally {
      setBusyDash(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/app/admin" className="hover:text-foreground">Administração</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">Configurações</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
      </header>

      <section className="max-w-2xl rounded-md border border-[var(--color-border)] bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Notificações
        </h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email-folha">Email da Folha de Pagamentos</Label>
          <Input
            id="email-folha"
            type="email"
            value={emailFolha}
            onChange={(e) => setEmailFolha(e.target.value)}
            placeholder="folha@empresa.com"
          />
          <p className="text-xs text-[var(--color-fg-muted)]">
            Para onde notificações de afastamentos aprovados são enviadas.
          </p>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={busy}>Salvar</Button>
        </div>
      </section>

      <section className="max-w-2xl rounded-md border border-[var(--color-border)] bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Dashboard
        </h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="aprovacao-lenta-horas">Aprovação lenta — limiar (horas)</Label>
          <Input
            id="aprovacao-lenta-horas"
            type="number"
            min={1}
            max={720}
            value={aprovacaoLentaHoras}
            onChange={(e) => setAprovacaoLentaHoras(Number(e.target.value))}
          />
          <p className="text-xs text-[var(--color-fg-muted)]">
            O card P50 no painel de saúde fica vermelho quando o tempo médio de aprovação superar este valor.
          </p>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveDash} disabled={busyDash}>Salvar</Button>
        </div>
      </section>

      <section className="max-w-2xl rounded-md border border-[var(--color-border)] bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Portal do Colaborador
        </h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="portal-saudacao">Saudação</Label>
            <Input
              id="portal-saudacao"
              value={portalSaudacao}
              onChange={(e) => setPortalSaudacao(e.target.value)}
              placeholder="Olá, {nome}."
            />
            <p className="text-xs text-[var(--color-fg-muted)]">
              Use <code>{"{nome}"}</code> para substituir pelo nome do colaborador.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="portal-banner">Banner</Label>
            <Input
              id="portal-banner"
              value={portalBanner}
              onChange={(e) => setPortalBanner(e.target.value)}
              placeholder="Consulte o status dos seus afastamentos..."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="portal-vazio">Mensagem de lista vazia</Label>
            <Input
              id="portal-vazio"
              value={portalVazio}
              onChange={(e) => setPortalVazio(e.target.value)}
              placeholder="Nenhum afastamento registrado para o seu CPF."
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={busy}>Salvar</Button>
        </div>
      </section>
    </div>
  );
}
