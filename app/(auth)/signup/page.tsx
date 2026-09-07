"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signUp } from "@/app/(auth)/actions";
import { emptyAuthFormState } from "@/app/(auth)/form-state";
import { Field, FormStatus, SubmitButton } from "@/app/(auth)/_components/form";

export default function SignupPage() {
  const [state, formAction] = useActionState(signUp, emptyAuthFormState);

  return (
    <>
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <Field
          label="Display name"
          name="displayName"
          autoComplete="nickname"
          hint="How you appear to others in your groups."
        />
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
        />
        <FormStatus state={state} />
        <SubmitButton>Create account</SubmitButton>
      </form>
      <p className="text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
