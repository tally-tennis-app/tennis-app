import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--chalk)] px-5 text-[var(--ink)]">
      <div className="relative max-w-2xl text-center">
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--clay)] uppercase">
          Error 404
        </p>
        <h1 className="font-display mt-5 text-6xl leading-[0.9] tracking-[-0.04em] sm:text-8xl">
          This court is empty.
        </h1>
        <p className="mx-auto mt-6 max-w-md leading-7 text-[var(--muted)]">
          The page you were looking for is outside the lines.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-12 items-center bg-[var(--ink)] px-6 font-semibold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--clay)] active:translate-y-px"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
