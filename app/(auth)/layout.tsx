export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[color:var(--paper)] px-6 py-12">
      <div className="fade-up w-full max-w-sm">{children}</div>
    </main>
  );
}
