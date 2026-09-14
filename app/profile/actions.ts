"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/src/lib/auth/dal";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
export async function updateProfile(
  _previous: { error?: string; success?: string },
  form: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await requireUser("/profile");
  const name = form.get("displayName");
  if (
    typeof name !== "string" ||
    name.trim().length < 1 ||
    name.trim().length > 50
  )
    return { error: "Use a display name between 1 and 50 characters." };
  const db = await createSupabaseServerClient();
  const { error } = await db
    .from("profiles")
    .update({ display_name: name.trim() })
    .eq("id", user.id);
  if (error)
    return { error: "Your profile could not be saved. Please try again." };
  revalidatePath("/", "layout");
  return { success: "Profile saved." };
}
