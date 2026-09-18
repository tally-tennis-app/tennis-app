"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createGroup, joinGroup } from "@/app/groups/actions";
import { emptyGroupFormState } from "@/app/groups/form-state";

function Submit({ children }: { children: string }) {
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

function FormError({ message }: { message: string | null }) {
  return (
    <div aria-live="polite" className="empty:hidden">
      {message ? (
        <p role="alert" className="text-critical text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function CreateGroupForm() {
  const [state, formAction] = useActionState(createGroup, emptyGroupFormState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="name" className="text-sm font-medium">
        Group name
      </label>
      <input
        id="name"
        name="name"
        required
        maxLength={60}
        className="border-line-strong bg-surface focus-visible:ring-focus border px-3 py-2 outline-none focus-visible:ring-2"
      />
      <FormError message={state.error} />
      <Submit>Create group</Submit>
    </form>
  );
}

export function JoinGroupForm() {
  const [state, formAction] = useActionState(joinGroup, emptyGroupFormState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="code" className="text-sm font-medium">
        Invite code
      </label>
      <input
        id="code"
        name="code"
        required
        autoCapitalize="characters"
        className="border-line-strong bg-surface focus-visible:ring-focus border px-3 py-2 font-mono uppercase outline-none focus-visible:ring-2"
      />
      <FormError message={state.error} />
      <Submit>Join group</Submit>
    </form>
  );
}
