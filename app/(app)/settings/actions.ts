"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/src/lib/auth/dal";
import { field, success, type ActionState } from "@/src/lib/forms";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export async function updateDisplayName(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/settings");
  const displayName = field(formData, "displayName");
  const values = { displayName };

  // Mirrors profiles_display_name_length, whose own error is generic.
  if (!displayName) return { error: "Enter a display name.", values };
  if (displayName.length > 50) {
    return {
      error: "Keep your display name to 50 characters or fewer.",
      values,
    };
  }

  const supabase = await createSupabaseServerClient();
  // RLS limits this to the caller's own row; the filter just names it.
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (error)
    return { error: "Your name could not be saved. Try again.", values };

  // The name appears in the shell, standings, rosters, and match cards.
  revalidatePath("/", "layout");
  return { ...success("Display name saved."), values };
}
