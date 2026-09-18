"use client";

import { WarningCircleIcon } from "@phosphor-icons/react/ssr";
import { useEffect } from "react";

import { Button, ButtonLink } from "@/src/components/ui/button";
import { EmptyState } from "@/src/components/ui/feedback";
import {
  reportClientBoundaryError,
  sanitizeErrorText,
} from "@/src/lib/observability/error-report";

// Inside the shell, so navigation stays usable when one page fails.
export default function AppError({
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
    <EmptyState
      icon={WarningCircleIcon}
      title="This page could not load"
      action={
        <>
          <Button onClick={retry}>Try again</Button>
          <ButtonLink href="/dashboard" variant="secondary">
            Go to Home
          </ButtonLink>
        </>
      }
    >
      Nothing you saved was lost. Check your connection, then try again.
      {reference ? (
        <span className="type-code mt-2 block text-sm">
          Reference: {reference}
        </span>
      ) : null}
    </EmptyState>
  );
}
