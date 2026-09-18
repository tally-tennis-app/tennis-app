"use client";

import { useActionState, type ComponentProps } from "react";

import { FormMessage } from "@/src/components/ui/feedback";
import { SubmitButton } from "@/src/components/ui/submit-button";
import { emptyActionState, type ActionState } from "@/src/lib/forms";

/** A one-click server action for low-stakes changes that need no confirmation. */
export function ActionButton({
  action,
  hidden,
  label,
  pendingLabel,
  variant,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  label: string;
  pendingLabel?: string;
  variant?: ComponentProps<typeof SubmitButton>["variant"];
}) {
  const [state, formAction] = useActionState(action, emptyActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton
        variant={variant}
        pendingLabel={pendingLabel}
        className="self-start"
      >
        {label}
      </SubmitButton>
      <FormMessage error={state.error} notice={state.notice} />
    </form>
  );
}
