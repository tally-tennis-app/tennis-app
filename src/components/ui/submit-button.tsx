"use client";

import { CircleNotchIcon } from "@phosphor-icons/react/ssr";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/src/components/ui/button";

/**
 * Disables itself while its form's action runs, which also prevents a double
 * submission. The server response, not this button, decides what happens next.
 */
export function SubmitButton({
  children,
  pendingLabel = "Working…",
  ...props
}: Omit<ComponentProps<typeof Button>, "type" | "children"> & {
  children: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? (
        <>
          <CircleNotchIcon
            aria-hidden
            weight="bold"
            className="size-4 animate-spin"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
