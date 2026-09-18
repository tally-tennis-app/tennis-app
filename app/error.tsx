"use client";

export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="bg-brand-navy grid min-h-screen place-items-center px-5 text-white">
      <div className="border-brand-basil-light max-w-xl border-l-2 pl-6 sm:pl-10">
        <p className="type-label text-brand-basil-light">Unexpected error</p>
        <h1 className="type-display mt-4 text-white">
          The ball clipped the net.
        </h1>
        <p className="mt-6 max-w-md leading-7 text-white/65">
          Something interrupted this point. Try the page again before starting a
          new rally.
        </p>
        <button
          type="button"
          onClick={retry}
          className="bg-brand-basil-light text-brand-navy-shade focus-visible:outline-brand-basil-light mt-8 min-h-12 px-6 font-semibold transition-transform hover:-translate-y-0.5 active:translate-y-px"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
