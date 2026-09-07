"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordReset } from "@/app/(auth)/actions";
import { emptyAuthFormState } from "@/app/(auth)/form-state";
import { Field, FormStatus, SubmitButton } from "@/app/(auth)/_components/form";

export default function ResetPasswordPage() {
  const [state, formAction] = useActionState(
    requestPasswordReset,
    emptyAuthFormState,
  );

  return (
    <>
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <FormStatus state={state} />
        <SubmitButton>Send reset link</SubmitButton>
      </form>
      <p className="text-sm text-[var(--muted)]">
        <Link href="/login" className="underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
