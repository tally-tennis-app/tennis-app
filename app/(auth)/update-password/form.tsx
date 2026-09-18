"use client";

import { useActionState } from "react";

import { updatePassword } from "@/app/(auth)/actions";
import { emptyAuthFormState } from "@/app/(auth)/form-state";
import { Field, FormStatus, SubmitButton } from "@/app/(auth)/_components/form";

export default function UpdatePasswordPage() {
  const [state, formAction] = useActionState(
    updatePassword,
    emptyAuthFormState,
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-16">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
        />
        <FormStatus state={state} />
        <SubmitButton>Save password</SubmitButton>
      </form>
    </main>
  );
}
