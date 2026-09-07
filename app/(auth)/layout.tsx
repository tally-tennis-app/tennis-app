import Link from "next/link";

// ponytail: placeholder shell, branding and layout are still open.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-16">
      <Link href="/" className="text-sm text-[var(--muted)] underline">
        Tennis App
      </Link>
      {children}
    </main>
  );
}
