"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";

import { signIn } from "@/app/(auth)/actions";
import { Alert, FormMessage } from "@/src/components/ui/feedback";
import { Field } from "@/src/components/ui/field";
import { SubmitButton } from "@/src/components/ui/submit-button";
import { safeRedirectPath } from "@/src/lib/auth/routes";
import { emptyActionState } from "@/src/lib/forms";

// Set by /auth/callback when an email link cannot be exchanged for a session.
const linkErrors: Record<string, { title: string; body: string }> = {
  link_expired: {
    title: "That link has expired or was already used",
    body: "Confirmation and reset links work once. Sign in if you already confirmed, or request a new reset link.",
  },
  link_invalid: {
    title: "That link is incomplete",
    body: "Open the most recent email from Tenny and tap the link again, or request a new one.",
  },
};

function LoginForm() {
  const [state, formAction] = useActionState(signIn, emptyActionState);
  const params = useSearchParams();
  const next = safeRedirectPath(params.get("next"));
  const linkError = linkErrors[params.get("error") ?? ""];

  return (
    <>
      {linkError ? (
        <Alert
          tone="warning"
          title={linkError.title}
          action={
            <Link href="/reset-password" className="font-semibold underline">
              Request a new link
            </Link>
          }
        >
          {linkError.body}
        </Alert>
      ) : null}
      <form action={formAction} className="flex flex-col gap-5">
        {next ? <input type="hidden" name="next" value={next} /> : null}
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
          autoComplete="current-password"
          required
        />
        <FormMessage error={state.error} />
        <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      </form>
    </>
  );
}

export default function Form() {
  return (
    <>
      <h1 className="type-title">Sign in</h1>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <div className="flex flex-col gap-2 text-sm">
        <Link
          href="/reset-password"
          className="text-ink-strong self-start underline"
        >
          Forgot your password?
        </Link>
        <p className="text-muted">
          New to Tenny?{" "}
          <Link
            href="/signup"
            className="text-ink-strong font-semibold underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </>
  );
}
