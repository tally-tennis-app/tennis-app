"use client";
import { useActionState } from "react";
import { updateProfile } from "./actions";
export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateProfile, {});
  return (
    <form
      onReset={(event) => event.preventDefault()}
      action={action}
      className="grid max-w-md gap-3"
    >
      <label htmlFor="displayName">Display name</label>
      <input
        className="min-h-11 rounded border border-[var(--line)] bg-white px-3"
        id="displayName"
        name="displayName"
        defaultValue={name}
        required
        minLength={1}
        maxLength={50}
      />
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
      <button
        disabled={pending}
        className="min-h-11 rounded border border-[var(--line)] px-4"
        type="submit"
      >
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
