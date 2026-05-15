import { PublicTopBar } from "@/components/layout/public-top-bar";
import { AppFooter } from "@/components/layout/app-footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col pb-14">
      <PublicTopBar />
      <main className="flex-1">{children}</main>
      <AppFooter />
    </div>
  );
}
