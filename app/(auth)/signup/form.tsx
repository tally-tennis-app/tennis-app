"use client";

import { EnvelopeSimpleIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useActionState } from "react";

import { signUp } from "@/app/(auth)/actions";
import { FormMessage } from "@/src/components/ui/feedback";
import { Field } from "@/src/components/ui/field";
import { SubmitButton } from "@/src/components/ui/submit-button";
import { emptyActionState } from "@/src/lib/forms";

export default function Form() {
  const [state, formAction] = useActionState(signUp, emptyActionState);

  if (state.done) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <EnvelopeSimpleIcon
          aria-hidden
          weight="bold"
          className="text-accent size-10"
        />
        <h1 className="type-title">Check your email</h1>
        <p>{state.notice}</p>
        <p className="text-muted text-sm">
          Open the link on this device to land straight in Tenny. Nothing
          arrived after a few minutes? Check spam, or{" "}
          <Link href="/login" className="text-ink-strong underline">
            sign in
          </Link>{" "}
          if you already confirmed.
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="type-title">Create your account</h1>
      <form action={formAction} className="flex flex-col gap-5">
        <Field
          label="Display name"
          name="displayName"
          autoComplete="nickname"
          hint="How you appear to others in your groups."
          maxLength={50}
          required
          defaultValue={state.values?.displayName}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          minLength={8}
          required
        />
        <FormMessage error={state.error} />
        <SubmitButton pendingLabel="Creating account…">
          Create account
        </SubmitButton>
      </form>
      <p className="text-muted text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-ink-strong font-semibold underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
