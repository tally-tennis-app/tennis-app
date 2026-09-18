"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/src/lib/auth/dal";
import { userFacingMessage } from "@/src/lib/errors";
import { asUuid, field, success, type ActionState } from "@/src/lib/forms";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export async function createGroup(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser("/groups");
  const name = field(formData, "name");
  const values = { name };

  if (!name) {
    return { error: "Give the group a name.", values };
  }

  // Mirrors the groups_name_length constraint. The form's maxLength is not a
  // guarantee, and the constraint's own error is reported generically.
  if (name.length > 60) {
    return { error: "Keep the group name to 60 characters or fewer.", values };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_group", {
    group_name: name,
  });

  if (error) {
    return { error: userFacingMessage(error), values };
  }

  revalidatePath("/groups");
  redirect(`/groups/${data}?created=1`);
}

export async function joinGroup(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser("/groups");
  const code = field(formData, "code");
  const values = { code };

  if (!code) {
    return { error: "Enter the invite code you were given.", values };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("join_group_by_code", { code });

  if (error) {
    return { error: userFacingMessage(error), values };
  }

  revalidatePath("/groups");
  redirect(`/groups/${data}?joined=1`);
}

/**
 * The mutations below take the group and member from the form rather than a
 * closure. Every one of them is authorized again inside its database function,
 * so a forged form value fails there rather than here.
 */
async function memberCall(
  formData: FormData,
  call: (
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    groupId: string,
    userId: string,
  ) => PromiseLike<{
    error: { message: string; code?: string; details?: string | null } | null;
  }>,
  notice: string,
): Promise<ActionState> {
  await requireUser();
  const groupId = asUuid(field(formData, "groupId"));
  const userId = asUuid(field(formData, "userId")) ?? "";
  if (!groupId) return { error: "That group could not be found." };

  const supabase = await createSupabaseServerClient();
  const { error } = await call(supabase, groupId, userId);
  if (error) return { error: userFacingMessage(error) };

  revalidatePath(`/groups/${groupId}`, "layout");
  return success(notice);
}

export async function removeMember(_previous: ActionState, formData: FormData) {
  return memberCall(
    formData,
    (supabase, groupId, userId) =>
      supabase.rpc("remove_group_member", {
        target_group: groupId,
        target_user: userId,
      }),
    "Member removed.",
  );
}

export async function restoreMember(
  _previous: ActionState,
  formData: FormData,
) {
  return memberCall(
    formData,
    (supabase, groupId, userId) =>
      supabase.rpc("restore_group_member", {
        target_group: groupId,
        target_user: userId,
      }),
    "Member restored.",
  );
}

export async function setMemberRole(
  _previous: ActionState,
  formData: FormData,
) {
  const role = field(formData, "role");
  return memberCall(
    formData,
    (supabase, groupId, userId) =>
      supabase.rpc("set_group_member_role", {
        target_group: groupId,
        target_user: userId,
        new_role: role,
      }),
    role === "organizer" ? "Promoted to organizer." : "Changed to player.",
  );
}

export async function rotateInvite(_previous: ActionState, formData: FormData) {
  return memberCall(
    formData,
    (supabase, groupId) =>
      supabase.rpc("rotate_group_invite", { target_group: groupId }),
    "New invite code created. The old one no longer works.",
  );
}

/**
 * Hands the organizer role over: promote the successor, then step down. Two
 * calls, in that order, so a failure part way leaves two organizers rather
 * than none.
 */
export async function transferOrganizer(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const groupId = asUuid(field(formData, "groupId"));
  const successor = asUuid(field(formData, "userId"));
  if (!groupId) return { error: "That group could not be found." };
  if (!successor) return { error: "Choose who should become organizer." };

  const supabase = await createSupabaseServerClient();
  const promote = await supabase.rpc("set_group_member_role", {
    target_group: groupId,
    target_user: successor,
    new_role: "organizer",
  });
  if (promote.error) return { error: userFacingMessage(promote.error) };

  const stepDown = await supabase.rpc("set_group_member_role", {
    target_group: groupId,
    target_user: user.id,
    new_role: "player",
  });
  revalidatePath(`/groups/${groupId}`, "layout");
  if (stepDown.error) {
    return {
      error: `They are now an organizer, but you could not step down: ${userFacingMessage(stepDown.error)}`,
    };
  }

  redirect(`/groups/${groupId}?transferred=1`);
}

export async function leaveGroup(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const groupId = asUuid(field(formData, "groupId"));
  if (!groupId) return { error: "That group could not be found." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("leave_group", {
    target_group: groupId,
  });
  if (error) return { error: userFacingMessage(error) };

  revalidatePath("/groups");
  redirect("/groups?left=1");
}
