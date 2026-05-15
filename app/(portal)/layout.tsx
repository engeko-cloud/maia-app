import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/logo-mark";
import { requirePortalSession } from "@/lib/portal-auth";
import { PortalLogoutButton } from "@/components/portal/portal-logout-button";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePortalSession();
  if (!session) redirect("/portal/login");

  return (
    <div className="min-h-screen bg-[var(--color-bg-subtle)]">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <LogoMark size="sm" />
            <span className="text-sm font-semibold tracking-tight">
              MAIA <span className="text-[var(--brand-accent-500)]">·</span> Minha Área
            </span>
          </div>
          <PortalLogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
