import Link from "next/link";

export default function NotFound() {
  return (
    <main className="bg-canvas text-ink grid min-h-screen place-items-center px-5">
      <div className="relative max-w-2xl text-center">
        <p className="type-label text-accent">Error 404</p>
        <h1 className="type-display mt-5">This court is empty.</h1>
        <p className="text-muted mx-auto mt-6 max-w-md leading-7">
          The page you were looking for is outside the lines.
        </p>
        <Link
          href="/"
          className="bg-action text-on-action mt-8 inline-flex min-h-12 items-center px-6 font-semibold transition-transform hover:-translate-y-0.5 active:translate-y-px"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
