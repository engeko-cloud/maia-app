import { PublicTopBar } from "@/components/layout/public-top-bar";
import { PublicFooter } from "@/components/layout/public-footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicTopBar />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
