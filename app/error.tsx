"use client";

export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--ink)] px-5 text-white">
      <div className="max-w-xl border-l-2 border-[var(--ball)] pl-6 sm:pl-10">
        <p className="eyebrow text-[var(--ball)]">Unexpected error</p>
        <h1 className="font-display mt-4 text-5xl leading-none tracking-tight sm:text-7xl">
          The ball clipped the net.
        </h1>
        <p className="mt-6 max-w-md leading-7 text-white/65">
          Something interrupted this point. Try the page again before starting a
          new rally.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-8 min-h-12 bg-[var(--ball)] px-6 font-semibold text-[var(--ink)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ball)] active:translate-y-px"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
