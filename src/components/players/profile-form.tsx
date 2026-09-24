"use client";

import { useActionState } from "react";

import { removeAvatar, updateProfile } from "@/app/(app)/settings/actions";
import { ActionButton } from "@/src/components/ui/action-button";
import { FormMessage } from "@/src/components/ui/feedback";
import { Field, inputClass } from "@/src/components/ui/field";
import { Avatar } from "@/src/components/ui/structure";
import { SubmitButton } from "@/src/components/ui/submit-button";
import { emptyActionState } from "@/src/lib/forms";
import type { Viewer } from "@/src/lib/profiles/queries";

export function ProfileForm({ viewer }: { viewer: Viewer }) {
  const [state, formAction] = useActionState(updateProfile, emptyActionState);

  return (
    <div className="flex max-w-md flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={viewer.displayName} size="lg" src={viewer.avatarUrl} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <label
              htmlFor="avatar"
              className="text-ink-strong text-sm font-semibold"
            >
              Profile picture
            </label>
            <p id="avatar-hint" className="text-muted -mt-1 text-sm">
              JPEG, PNG, or WebP, under 2 MB. Players in your groups can see it.
            </p>
            <input
              id="avatar"
              type="file"
              name="avatar"
              accept="image/jpeg,image/png,image/webp"
              aria-describedby="avatar-hint"
              className={`${inputClass} py-2`}
            />
          </div>
        </div>

        <Field
          label="Display name"
          name="displayName"
          autoComplete="nickname"
          maxLength={50}
          required
          hint="How you appear to others in your groups."
          defaultValue={state.values?.displayName ?? viewer.displayName}
        />

        <Field
          label="Hometown"
          name="hometown"
          autoComplete="address-level2"
          maxLength={60}
          hint="Optional. Shown to players in your groups."
          defaultValue={state.values?.hometown ?? viewer.hometown ?? ""}
        />

        <Field label="Bio" name="bio" hint="Optional, up to 280 characters.">
          <textarea
            id="bio"
            name="bio"
            rows={3}
            maxLength={280}
            aria-describedby="bio-hint"
            className={`${inputClass} py-2`}
            defaultValue={state.values?.bio ?? viewer.bio ?? ""}
          />
        </Field>

        <FormMessage error={state.error} notice={state.notice} />
        <SubmitButton
          variant="secondary"
          pendingLabel="Saving…"
          className="self-start"
        >
          Save profile
        </SubmitButton>
      </form>

      {/* Its own form: a nested one would be invalid markup. */}
      {viewer.avatarPath ? (
        <ActionButton
          action={removeAvatar}
          hidden={{}}
          label="Remove picture"
          pendingLabel="Removing…"
          variant="quiet"
        />
      ) : null}
    </div>
  );
}
