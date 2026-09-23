"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/src/lib/auth/dal";
import { field, success, type ActionState } from "@/src/lib/forms";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

/** Mirrors allowed_mime_types and file_size_limit on the avatars bucket. */
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_BYTES = 2_097_152;

export async function updateProfile(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/settings");
  const displayName = field(formData, "displayName");
  const hometown = field(formData, "hometown");
  const bio = field(formData, "bio");
  const values = { displayName, hometown, bio };

  // These mirror the profiles CHECK constraints, whose own errors are generic.
  if (!displayName) return { error: "Enter a display name.", values };
  if (displayName.length > 50) {
    return {
      error: "Keep your display name to 50 characters or fewer.",
      values,
    };
  }
  if (hometown.length > 60) {
    return { error: "Keep your hometown to 60 characters or fewer.", values };
  }
  if (bio.length > 280) {
    return { error: "Keep your bio to 280 characters or fewer.", values };
  }

  const supabase = await createSupabaseServerClient();
  const update: {
    display_name: string;
    hometown: string | null;
    bio: string | null;
    avatar_path?: string;
  } = {
    display_name: displayName,
    // Blank means "not set": the constraints reject an empty string.
    hometown: hometown || null,
    bio: bio || null,
  };

  const picture = formData.get("avatar");
  if (picture instanceof File && picture.size > 0) {
    if (!AVATAR_TYPES.includes(picture.type)) {
      return { error: "Choose a JPEG, PNG, or WebP image.", values };
    }
    if (picture.size > AVATAR_MAX_BYTES) {
      return { error: "Choose a picture under 2 MB.", values };
    }

    // One fixed path per player, overwritten in place: no orphaned objects to
    // clean up, and storage policies confine it to the caller's own prefix.
    // ponytail: no server-side resize, the 2 MB limit is the whole control.
    const path = `${user.id}/avatar`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, picture, { contentType: picture.type, upsert: true });

    if (uploadError) {
      return { error: "Your picture could not be saved. Try again.", values };
    }
    update.avatar_path = path;
  }

  // RLS limits this to the caller's own row; the filter just names it.
  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error)
    return { error: "Your profile could not be saved. Try again.", values };

  // The name and picture appear in the shell, standings, rosters, and cards.
  revalidatePath("/", "layout");
  return { ...success("Profile saved."), values };
}

/** Takes no input: useActionState's arguments are both unused here. */
export async function removeAvatar(): Promise<ActionState> {
  const user = await requireUser("/settings");
  const supabase = await createSupabaseServerClient();

  await supabase.storage.from("avatars").remove([`${user.id}/avatar`]);
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", user.id);

  if (error) return { error: "Your picture could not be removed. Try again." };

  revalidatePath("/", "layout");
  return success("Picture removed.");
}
