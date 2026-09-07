"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";

import { signIn } from "@/app/(auth)/actions";
import { emptyAuthFormState } from "@/app/(auth)/form-state";
import { Field, FormStatus, SubmitButton } from "@/app/(auth)/_components/form";
import { safeRedirectPath } from "@/src/lib/auth/routes";

function LoginForm() {
  const [state, formAction] = useActionState(signIn, emptyAuthFormState);
  const next = safeRedirectPath(useSearchParams().get("next"));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
      />
      <FormStatus state={state} />
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <p className="text-sm text-[var(--muted)]">
        <Link href="/reset-password" className="underline">
          Forgot your password?
        </Link>
        {" · "}
        <Link href="/signup" className="underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
