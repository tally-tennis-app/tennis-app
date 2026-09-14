import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
export function AppNav() {
  return (
    <header className="border-b border-[var(--line)] px-5 py-4">
      <a href="#main-content" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <nav
        aria-label="Application"
        className="mx-auto flex max-w-5xl flex-wrap items-center gap-5"
      >
        <Link className="font-semibold" href="/dashboard">
          Tally Tennis
        </Link>
        {[
          ["Groups", "/groups"],
          ["Matches", "/matches"],
          ["Standings", "/standings"],
          ["Profile", "/profile"],
        ].map(([label, href]) => (
          <Link className="underline" key={href} href={href}>
            {label}
          </Link>
        ))}
        <form action={signOut}>
          <button type="submit" className="min-h-11 underline">
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
export function AppPage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-10"
      >
        {children}
      </main>
    </>
  );
}
