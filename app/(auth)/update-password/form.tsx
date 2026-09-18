"use client";

import { useActionState } from "react";

import { updatePassword } from "@/app/(auth)/actions";
import { FormMessage } from "@/src/components/ui/feedback";
import { Field } from "@/src/components/ui/field";
import { SubmitButton } from "@/src/components/ui/submit-button";
import { emptyActionState } from "@/src/lib/forms";

// Reached from a recovery link through /auth/callback, which signs the player
// in first. Not in authPages, so a signed-in player is not bounced away.
export default function Form() {
  const [state, formAction] = useActionState(updatePassword, emptyActionState);

  return (
    <>
      <h1 className="type-title">Choose a new password</h1>
      <form action={formAction} className="flex flex-col gap-5">
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          minLength={8}
          required
        />
        <FormMessage error={state.error} />
        <SubmitButton pendingLabel="Saving…">Save password</SubmitButton>
      </form>
    </>
  );
}
