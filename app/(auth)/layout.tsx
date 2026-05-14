export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--color-bg-subtle)] to-[var(--brand-primary-50)] p-4 sm:p-6">
      {children}
    </div>
  );
}
