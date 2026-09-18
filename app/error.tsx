"use client";

import { useEffect } from "react";

import { TennyMark } from "@/src/components/brand";
import { Button, ButtonLink } from "@/src/components/ui/button";
import {
  reportClientBoundaryError,
  sanitizeErrorText,
} from "@/src/lib/observability/error-report";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    reportClientBoundaryError(error);
  }, [error]);

  const reference = sanitizeErrorText(error.digest, 80);

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
      {reference ? (
        <p className="type-code text-muted text-sm">Reference: {reference}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button onClick={retry}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Return home
        </ButtonLink>
      </div>
    </main>
  );
}
