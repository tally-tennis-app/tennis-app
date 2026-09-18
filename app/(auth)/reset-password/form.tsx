"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordReset } from "@/app/(auth)/actions";
import { FormMessage } from "@/src/components/ui/feedback";
import { Field } from "@/src/components/ui/field";
import { SubmitButton } from "@/src/components/ui/submit-button";
import { emptyActionState } from "@/src/lib/forms";

export default function Form() {
  const [state, formAction] = useActionState(
    requestPasswordReset,
    emptyActionState,
  );

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="type-title">Reset your password</h1>
        <p className="text-muted">
          We will email you a link to choose a new password.
        </p>
      </div>
      <form action={formAction} className="flex flex-col gap-5">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
        />
        <FormMessage error={state.error} notice={state.notice} />
        <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
      </form>
      <Link
        href="/login"
        className="text-ink-strong self-start text-sm underline"
      >
        Back to sign in
      </Link>
    </>
  );
}
