"use client";

import { WarningCircleIcon } from "@phosphor-icons/react/ssr";

import { Button, ButtonLink } from "@/src/components/ui/button";
import { EmptyState } from "@/src/components/ui/feedback";

// Inside the shell, so navigation stays usable when one page fails.
export default function AppError({
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
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
    </EmptyState>
  );
}
