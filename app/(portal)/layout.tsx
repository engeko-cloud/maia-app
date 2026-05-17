import { redirect } from "next/navigation";
import { requirePortalSession } from "@/lib/portal-auth";
import { PortalHomeButton } from "@/components/portal/portal-home-button";
import { PortalLogoutButton } from "@/components/portal/portal-logout-button";
import { AppFooter } from "@/components/layout/app-footer";
import { Logo } from "@/components/brand/logo";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePortalSession();
  if (!session) redirect("/portal/login");

  return (
    <div className="min-h-screen bg-[var(--color-bg-subtle)] pb-14">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Logo size="md" />
          </div>
          <div className="flex items-center gap-1">
            <PortalHomeButton />
            <PortalLogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-10">{children}</main>
      <AppFooter />
    </div>
  );
}
