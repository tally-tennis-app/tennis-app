"use client";

import { TennyMark } from "@/src/components/brand";
import { Button, ButtonLink } from "@/src/components/ui/button";

export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main
      id="main"
      className="max-w-content mx-auto flex w-full flex-1 flex-col justify-center gap-6 px-4 py-16 sm:px-8"
    >
      <TennyMark height={56} alt="" />
      <p className="type-label text-critical">Unexpected error</p>
      <h1 className="type-display max-w-[14ch]">The ball clipped the net.</h1>
      <p className="text-muted max-w-prose text-lg">
        Something interrupted this page. Nothing you saved was lost. Try again,
        and if it keeps happening, check your connection.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={retry}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Return home
        </ButtonLink>
      </div>
    </main>
  );
}
