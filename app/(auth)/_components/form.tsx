"use client";

import { useFormStatus } from "react-dom";

import type { AuthFormState } from "@/app/(auth)/form-state";

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required = true,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}) {
  const hintId = hint ? `${name}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        aria-describedby={hintId}
        className="border-line-strong bg-surface focus-visible:ring-focus border px-3 py-2 text-base outline-none focus-visible:ring-2"
      />
      {hint ? (
        <p id={hintId} className="text-muted text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-action text-on-action px-4 py-2 font-medium disabled:opacity-60"
    >
      {pending ? "Working…" : children}
    </button>
  );
}

/**
 * Both messages live in an aria-live region so a screen reader announces a
 * failed sign-in, which is otherwise a silent visual-only change.
 */
export function FormStatus({ state }: { state: AuthFormState }) {
  return (
    <div aria-live="polite" className="empty:hidden">
      {state.error ? (
        <p role="alert" className="text-critical text-sm">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p className="text-positive text-sm">{state.notice}</p>
      ) : null}
    </div>
  );
}
