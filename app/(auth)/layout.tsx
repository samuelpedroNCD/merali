export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth screens are a fixed composition (dark panel + cream form),
  // independent of the app light/dark theme.
  return <div className="h-screen w-screen overflow-hidden">{children}</div>;
}
