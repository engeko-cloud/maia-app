import { FapptoryAttribution } from "@/components/brand/fapptory-attribution";

export default function PortalPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-[var(--color-bg-subtle)] to-[var(--brand-primary-50)] p-4 sm:p-6">
      {children}
      <FapptoryAttribution size="md" />
    </div>
  );
}
