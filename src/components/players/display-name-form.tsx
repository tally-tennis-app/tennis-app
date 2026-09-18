"use client";

import { useActionState } from "react";

import { updateDisplayName } from "@/app/(app)/settings/actions";
import { FormMessage } from "@/src/components/ui/feedback";
import { Field } from "@/src/components/ui/field";
import { SubmitButton } from "@/src/components/ui/submit-button";
import { emptyActionState } from "@/src/lib/forms";

export function DisplayNameForm({ current }: { current: string }) {
  const [state, formAction] = useActionState(
    updateDisplayName,
    emptyActionState,
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <Field
        label="Display name"
        name="displayName"
        autoComplete="nickname"
        maxLength={50}
        required
        hint="How you appear to others in your groups."
        defaultValue={state.values?.displayName ?? current}
      />
      <FormMessage error={state.error} notice={state.notice} />
      <SubmitButton
        variant="secondary"
        pendingLabel="Saving…"
        className="self-start"
      >
        Save name
      </SubmitButton>
    </form>
  );
}
