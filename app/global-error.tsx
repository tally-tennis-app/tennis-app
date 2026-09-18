"use client";

import "./globals.css";

// Replaces the root layout when that layout itself fails, so it must render
// its own document and cannot rely on fonts or components the layout loads.
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col justify-center gap-6 px-4 py-16 sm:px-8">
        <h1 className="type-display">Tenny could not load.</h1>
        <p className="text-muted max-w-prose text-lg">
          Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={retry}
          className="bg-action text-on-action min-h-11 self-start px-5 font-semibold"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
